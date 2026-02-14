/**
 * Hive Comprehensive E2E Test Suite
 *
 * Tests all API endpoints, UI flows, and integration points.
 * Run with: node e2e/hive-e2e.test.mjs
 */

import { Keypair, Connection, PublicKey, Transaction } from '@solana/web3.js';
import { getAssociatedTokenAddress, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import bs58 from 'bs58';
import nacl from 'tweetnacl';

const API_BASE = process.env.API_URL || 'https://kamiyo-protocol-4c70.onrender.com';
const SOLANA_RPC = 'https://api.mainnet-beta.solana.com';

// Test state
let testWallet;
let authToken;
let teamId;
let memberId;
let proposalId;

// Test results tracking
const results = { passed: 0, failed: 0, skipped: 0, tests: [] };

function log(status, name, details = '') {
  const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⏭️';
  console.log(`${icon} ${name}${details ? `: ${details}` : ''}`);
  results.tests.push({ status, name, details });
  if (status === 'PASS') results.passed++;
  else if (status === 'FAIL') results.failed++;
  else results.skipped++;
}

async function test(name, fn) {
  try {
    await fn();
    log('PASS', name);
  } catch (err) {
    log('FAIL', name, err.message);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed');
}

async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

  const res = await fetch(`${API_BASE}${path}`, { headers, ...options });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, data };
}

// ============================================
// SECTION 1: AUTHENTICATION TESTS
// ============================================

async function testAuthentication() {
  console.log('\n📋 AUTHENTICATION TESTS\n');

  // Generate test wallet
  testWallet = Keypair.generate();
  const wallet = testWallet.publicKey.toBase58();

  await test('GET /api/auth/challenge - returns challenge', async () => {
    const res = await api(`/api/auth/challenge?wallet=${wallet}`);
    assert(res.ok, `Expected 200, got ${res.status}`);
    assert(res.data.challenge, 'Missing challenge');
    assert(res.data.challenge.includes(wallet), 'Challenge should contain wallet');
  });

  await test('POST /api/auth/wallet - authenticates with signature', async () => {
    const { data: { challenge } } = await api(`/api/auth/challenge?wallet=${wallet}`);
    const messageBytes = new TextEncoder().encode(challenge);
    const signature = nacl.sign.detached(messageBytes, testWallet.secretKey);
    const signatureB58 = bs58.encode(signature);

    const res = await api('/api/auth/wallet', {
      method: 'POST',
      body: JSON.stringify({ wallet, signature: signatureB58 }),
    });

    assert(res.ok, `Expected 200, got ${res.status}: ${JSON.stringify(res.data)}`);
    assert(res.data.token, 'Missing token');
    authToken = res.data.token;
  });

  await test('POST /api/auth/wallet - rejects invalid signature', async () => {
    const res = await api('/api/auth/wallet', {
      method: 'POST',
      body: JSON.stringify({ wallet, signature: 'invalid' }),
    });
    assert(!res.ok, 'Should reject invalid signature');
  });

  await test('Protected endpoint - rejects without token', async () => {
    const savedToken = authToken;
    authToken = null;
    const res = await api('/api/hive-teams');
    authToken = savedToken;
    assert(res.status === 401, `Expected 401, got ${res.status}`);
  });
}

// ============================================
// SECTION 2: TEAM MANAGEMENT TESTS
// ============================================

async function testTeamManagement() {
  console.log('\n📋 TEAM MANAGEMENT TESTS\n');

  await test('GET /api/hive-teams - lists teams (empty)', async () => {
    const res = await api('/api/hive-teams');
    assert(res.ok, `Expected 200, got ${res.status}`);
    assert(Array.isArray(res.data.teams), 'teams should be array');
  });

  await test('POST /api/hive-teams - creates team', async () => {
    const res = await api('/api/hive-teams', {
      method: 'POST',
      body: JSON.stringify({
        name: 'E2E Test Team',
        currency: 'USDC',
        dailyLimit: 100,
        members: [
          { agentId: 'agent-1', role: 'admin', drawLimit: 50 },
          { agentId: 'agent-2', role: 'member', drawLimit: 30 },
        ],
      }),
    });

    assert(res.ok, `Expected 201, got ${res.status}: ${JSON.stringify(res.data)}`);
    assert(res.data.id, 'Missing team id');
    assert(res.data.name === 'E2E Test Team', 'Wrong name');
    assert(res.data.members.length === 2, 'Should have 2 members');
    teamId = res.data.id;
    memberId = res.data.members[0].id;
  });

  await test('POST /api/hive-teams - rejects missing fields', async () => {
    const res = await api('/api/hive-teams', {
      method: 'POST',
      body: JSON.stringify({ name: 'Test' }), // missing currency, dailyLimit
    });
    assert(!res.ok, 'Should reject missing fields');
  });

  await test('POST /api/hive-teams - rejects invalid dailyLimit', async () => {
    const res = await api('/api/hive-teams', {
      method: 'POST',
      body: JSON.stringify({ name: 'Test', currency: 'USDC', dailyLimit: -10 }),
    });
    assert(!res.ok, 'Should reject negative dailyLimit');
  });

  await test('GET /api/hive-teams/:id - returns team detail', async () => {
    const res = await api(`/api/hive-teams/${teamId}`);
    assert(res.ok, `Expected 200, got ${res.status}`);
    assert(res.data.id === teamId, 'Wrong team id');
    assert(res.data.poolBalance === 0, 'Pool should start at 0');
    assert(res.data.dailySpend === 0, 'Daily spend should be 0');
  });

  await test('GET /api/hive-teams/:id - returns 404 for invalid id', async () => {
    const res = await api('/api/hive-teams/invalid_id');
    assert(res.status === 404, `Expected 404, got ${res.status}`);
  });

  await test('PATCH /api/hive-teams/:id/budget - updates daily limit', async () => {
    const res = await api(`/api/hive-teams/${teamId}/budget`, {
      method: 'PATCH',
      body: JSON.stringify({ dailyLimit: 200 }),
    });
    assert(res.ok, `Expected 200, got ${res.status}`);

    const detail = await api(`/api/hive-teams/${teamId}`);
    assert(detail.data.dailyLimit === 200, 'Daily limit not updated');
  });

  await test('PATCH /api/hive-teams/:id/budget - updates member limit', async () => {
    const res = await api(`/api/hive-teams/${teamId}/budget`, {
      method: 'PATCH',
      body: JSON.stringify({ memberLimits: { [memberId]: 75 } }),
    });
    assert(res.ok, `Expected 200, got ${res.status}`);

    const detail = await api(`/api/hive-teams/${teamId}`);
    const member = detail.data.members.find(m => m.id === memberId);
    assert(member.drawLimit === 75, 'Member limit not updated');
  });
}

// ============================================
// SECTION 3: MEMBER MANAGEMENT TESTS
// ============================================

async function testMemberManagement() {
  console.log('\n📋 MEMBER MANAGEMENT TESTS\n');

  let newMemberId;

  await test('POST /api/hive-teams/:id/members - adds member', async () => {
    const res = await api(`/api/hive-teams/${teamId}/members`, {
      method: 'POST',
      body: JSON.stringify({ agentId: 'agent-3', role: 'member', drawLimit: 25 }),
    });
    assert(res.ok, `Expected 201, got ${res.status}: ${JSON.stringify(res.data)}`);
    assert(res.data.id, 'Missing member id');
    newMemberId = res.data.id;
  });

  await test('POST /api/hive-teams/:id/members - rejects missing agentId', async () => {
    const res = await api(`/api/hive-teams/${teamId}/members`, {
      method: 'POST',
      body: JSON.stringify({ role: 'member' }),
    });
    assert(!res.ok, 'Should reject missing agentId');
  });

  await test('POST /api/hive-teams/:id/members - rejects invalid drawLimit', async () => {
    const res = await api(`/api/hive-teams/${teamId}/members`, {
      method: 'POST',
      body: JSON.stringify({ agentId: 'test', drawLimit: -5 }),
    });
    assert(!res.ok, 'Should reject negative drawLimit');
  });

  await test('DELETE /api/hive-teams/:id/members/:memberId - removes member', async () => {
    const res = await api(`/api/hive-teams/${teamId}/members/${newMemberId}`, {
      method: 'DELETE',
    });
    assert(res.ok, `Expected 200, got ${res.status}`);

    const detail = await api(`/api/hive-teams/${teamId}`);
    const member = detail.data.members.find(m => m.id === newMemberId);
    assert(!member, 'Member should be deleted');
  });

  await test('DELETE /api/hive-teams/:id/members/:memberId - returns 404 for invalid', async () => {
    const res = await api(`/api/hive-teams/${teamId}/members/invalid_id`, {
      method: 'DELETE',
    });
    assert(res.status === 404, `Expected 404, got ${res.status}`);
  });
}

// ============================================
// SECTION 4: FUNDING TESTS
// ============================================

let poolFunded = false;

async function testFunding() {
  console.log('\n📋 FUNDING TESTS\n');

  await test('POST /api/hive-teams/:id/fund - handles funding request', async () => {
    const res = await api(`/api/hive-teams/${teamId}/fund`, {
      method: 'POST',
      body: JSON.stringify({ amount: 50 }),
    });
    assert(res.ok, `Expected 200, got ${res.status}: ${JSON.stringify(res.data)}`);

    // Check if this is dev mode (auto-credit) or a production deposit flow.
    const detail = await api(`/api/hive-teams/${teamId}`);
    if (detail.data.poolBalance >= 50) {
      poolFunded = true;
      console.log('   (dev mode: pool auto-credited)');
    }
  });

  await test('POST /api/hive-teams/:id/fund - rejects invalid amount', async () => {
    const res = await api(`/api/hive-teams/${teamId}/fund`, {
      method: 'POST',
      body: JSON.stringify({ amount: 0 }),
    });
    assert(!res.ok, 'Should reject zero amount');
  });

  await test('POST /api/hive-teams/:id/fund-tokens - rejects invalid transaction', async () => {
    const res = await api(`/api/hive-teams/${teamId}/fund-tokens`, {
      method: 'POST',
      body: JSON.stringify({ signedTransaction: 'aW52YWxpZA==' }),
    });
    assert(!res.ok, 'Should reject invalid transaction');
    assert(res.data.error, 'Should have error message');
  });

  await test('POST /api/hive-teams/:id/fund-tokens - rejects missing transaction', async () => {
    const res = await api(`/api/hive-teams/${teamId}/fund-tokens`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
    assert(!res.ok, 'Should reject missing transaction');
  });

  // If pool not funded yet (production mode), use internal test endpoint
  if (!poolFunded) {
    await test('POST /api/hive-teams/:id/fund-test - credits pool for testing', async () => {
      const res = await api(`/api/hive-teams/${teamId}/fund-test`, {
        method: 'POST',
        body: JSON.stringify({ amount: 100 }),
      });
      if (res.ok) {
        poolFunded = true;
        console.log('   (test endpoint: pool credited)');
      } else if (res.status === 404) {
        // Test endpoint not available - try direct pool update via fund endpoint retry
        // This is expected in production without ENABLE_TEST_FUNDING
        console.log('   (test endpoint not available - skipping pool-dependent tests)');
      } else {
        throw new Error(`Unexpected: ${res.status} - ${JSON.stringify(res.data)}`);
      }
    });
  }
}

// ============================================
// SECTION 5: DRAW HISTORY TESTS
// ============================================

async function testDrawHistory() {
  console.log('\n📋 DRAW HISTORY TESTS\n');

  await test('GET /api/hive-teams/:id/draws - returns draws', async () => {
    const res = await api(`/api/hive-teams/${teamId}/draws`);
    assert(res.ok, `Expected 200, got ${res.status}`);
    assert(Array.isArray(res.data.draws), 'draws should be array');
    assert(typeof res.data.total === 'number', 'total should be number');
  });

  await test('GET /api/hive-teams/:id/draws - respects limit', async () => {
    const res = await api(`/api/hive-teams/${teamId}/draws?limit=5`);
    assert(res.ok, `Expected 200, got ${res.status}`);
    assert(res.data.draws.length <= 5, 'Should respect limit');
  });

  await test('GET /api/hive-teams/:id/draws - filters by agentId', async () => {
    const res = await api(`/api/hive-teams/${teamId}/draws?agentId=agent-1`);
    assert(res.ok, `Expected 200, got ${res.status}`);
    // All returned draws should be for agent-1
    for (const draw of res.data.draws) {
      assert(draw.agentId === 'agent-1', 'Should filter by agentId');
    }
  });
}

// ============================================
// SECTION 6: PROPOSAL & VOTING TESTS
// ============================================

async function testProposalVoting() {
  console.log('\n📋 PROPOSAL & VOTING TESTS\n');

  // Check pool balance first
  const balanceCheck = await api(`/api/hive-teams/${teamId}`);
  const hasBalance = balanceCheck.data.poolBalance >= 10;

  if (!hasBalance && !poolFunded) {
    console.log('   ⚠️  Pool not funded - skipping proposal tests');
    log('SKIP', 'Proposal tests', 'Pool not funded (production mode)');
    return;
  }

  await test('POST /api/hive-teams/:id/propose-task - creates proposal', async () => {
    const res = await api(`/api/hive-teams/${teamId}/propose-task`, {
      method: 'POST',
      body: JSON.stringify({
        description: 'Test proposal for E2E',
        budget: 10,
        minBid: 1,
        voteDurationSec: 5,
        revealDurationSec: 5,
      }),
    });
    assert(res.ok, `Expected 201, got ${res.status}: ${JSON.stringify(res.data)}`);
    assert(res.data.proposalId, 'Missing proposalId');
    assert(res.data.actionHash, 'Missing actionHash');
    proposalId = res.data.proposalId;
  });

  await test('POST /api/hive-teams/:id/propose-task - rejects missing fields', async () => {
    const res = await api(`/api/hive-teams/${teamId}/propose-task`, {
      method: 'POST',
      body: JSON.stringify({ description: 'Test' }), // missing budget
    });
    assert(!res.ok, 'Should reject missing budget');
  });

  await test('GET /api/hive-teams/:id/proposals - lists proposals', async () => {
    const res = await api(`/api/hive-teams/${teamId}/proposals`);
    assert(res.ok, `Expected 200, got ${res.status}`);
    assert(Array.isArray(res.data.proposals), 'proposals should be array');
    assert(res.data.proposals.length > 0, 'Should have at least one proposal');
  });

  await test('GET /api/hive-teams/:id/proposals/:proposalId - returns detail', async () => {
    const res = await api(`/api/hive-teams/${teamId}/proposals/${proposalId}`);
    assert(res.ok, `Expected 200, got ${res.status}`);
    assert(res.data.proposal.id === proposalId, 'Wrong proposal id');
    assert(res.data.proposal.status === 'voting', 'Should be in voting phase');
  });

  await test('POST /api/hive-teams/:id/vote-bid - submits vote', async () => {
    const res = await api(`/api/hive-teams/${teamId}/vote-bid`, {
      method: 'POST',
      body: JSON.stringify({
        proposalId,
        memberId,
        proof: '0xtest',
        voteNullifier: `nullifier_${Date.now()}`,
        voteCommitment: '0xcommit',
        bidCommitment: '0xbid',
      }),
    });
    assert(res.ok, `Expected 200, got ${res.status}: ${JSON.stringify(res.data)}`);
    assert(res.data.voteId, 'Missing voteId');
  });

  await test('POST /api/hive-teams/:id/vote-bid - rejects duplicate nullifier', async () => {
    const nullifier = `nullifier_dup_${Date.now()}`;

    // First vote
    await api(`/api/hive-teams/${teamId}/vote-bid`, {
      method: 'POST',
      body: JSON.stringify({
        proposalId,
        memberId,
        proof: '0x',
        voteNullifier: nullifier,
        voteCommitment: '0x',
        bidCommitment: '0x',
      }),
    });

    // Duplicate
    const res = await api(`/api/hive-teams/${teamId}/vote-bid`, {
      method: 'POST',
      body: JSON.stringify({
        proposalId,
        memberId,
        proof: '0x',
        voteNullifier: nullifier,
        voteCommitment: '0x',
        bidCommitment: '0x',
      }),
    });
    assert(!res.ok, 'Should reject duplicate nullifier');
  });

  // Wait for vote phase to end
  await test('Wait for vote phase to end', async () => {
    await new Promise(r => setTimeout(r, 6000));
  });

  await test('POST /api/hive-teams/:id/reveal-bid - reveals vote', async () => {
    // First get the vote
    const detail = await api(`/api/hive-teams/${teamId}/proposals/${proposalId}`);
    const vote = detail.data.votes[0];
    if (!vote) {
      throw new Error('No votes to reveal');
    }

    const res = await api(`/api/hive-teams/${teamId}/reveal-bid`, {
      method: 'POST',
      body: JSON.stringify({
        proposalId,
        memberId: vote.memberId,
        voteNullifier: vote.voteNullifier,
        voteValue: 1, // YES
        voteSalt: 'salt',
        bidAmount: 5,
        bidSalt: 'bidsalt',
      }),
    });
    assert(res.ok, `Expected 200, got ${res.status}: ${JSON.stringify(res.data)}`);
  });

  await test('POST /api/hive-teams/:id/reveal-bid - rejects low bid', async () => {
    const detail = await api(`/api/hive-teams/${teamId}/proposals/${proposalId}`);
    const unrevealed = detail.data.votes.find(v => !v.revealed);
    if (!unrevealed) {
      log('SKIP', 'POST reveal-bid low bid', 'No unrevealed votes');
      return;
    }

    const res = await api(`/api/hive-teams/${teamId}/reveal-bid`, {
      method: 'POST',
      body: JSON.stringify({
        proposalId,
        memberId: unrevealed.memberId,
        voteNullifier: unrevealed.voteNullifier,
        voteValue: 1,
        voteSalt: 'salt',
        bidAmount: 0, // Below minBid
        bidSalt: 'bidsalt',
      }),
    });
    assert(!res.ok, 'Should reject bid below minimum');
  });
}

// ============================================
// SECTION 7: TEAM DELETION TESTS
// ============================================

async function testTeamDeletion() {
  console.log('\n📋 TEAM DELETION TESTS\n');

  // Create a fresh team to delete
  const createRes = await api('/api/hive-teams', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Team to Delete',
      currency: 'USDC',
      dailyLimit: 50,
    }),
  });
  const deleteTeamId = createRes.data.id;

  await test('DELETE /api/hive-teams/:id - deletes team', async () => {
    const res = await api(`/api/hive-teams/${deleteTeamId}`, {
      method: 'DELETE',
    });
    assert(res.ok, `Expected 200, got ${res.status}`);

    // Verify it's gone
    const check = await api(`/api/hive-teams/${deleteTeamId}`);
    assert(check.status === 404, 'Team should be deleted');
  });

  await test('DELETE /api/hive-teams/:id - returns 403/404 for invalid', async () => {
    const res = await api('/api/hive-teams/invalid_team', {
      method: 'DELETE',
    });
    // Auth middleware may return 403 (not owner) before checking if team exists
    // Either 403 or 404 is acceptable for non-existent teams
    assert(res.status === 404 || res.status === 403, `Expected 403 or 404, got ${res.status}`);
  });
}

// ============================================
// SECTION 8: OWNERSHIP TESTS
// ============================================

async function testOwnership() {
  console.log('\n📋 OWNERSHIP TESTS\n');

  // Create another wallet
  const otherWallet = Keypair.generate();
  const otherWalletAddr = otherWallet.publicKey.toBase58();

  // Authenticate as other wallet
  const { data: { challenge } } = await api(`/api/auth/challenge?wallet=${otherWalletAddr}`);
  const sig = nacl.sign.detached(new TextEncoder().encode(challenge), otherWallet.secretKey);
  const { data: { token: otherToken } } = await api('/api/auth/wallet', {
    method: 'POST',
    body: JSON.stringify({ wallet: otherWalletAddr, signature: bs58.encode(sig) }),
  });

  const savedToken = authToken;
  authToken = otherToken;

  await test('Non-owner cannot add member', async () => {
    const res = await api(`/api/hive-teams/${teamId}/members`, {
      method: 'POST',
      body: JSON.stringify({ agentId: 'hacker-agent' }),
    });
    assert(res.status === 403, `Expected 403, got ${res.status}`);
  });

  await test('Non-owner cannot update budget', async () => {
    const res = await api(`/api/hive-teams/${teamId}/budget`, {
      method: 'PATCH',
      body: JSON.stringify({ dailyLimit: 9999 }),
    });
    assert(res.status === 403, `Expected 403, got ${res.status}`);
  });

  await test('Non-owner cannot delete team', async () => {
    const res = await api(`/api/hive-teams/${teamId}`, {
      method: 'DELETE',
    });
    assert(res.status === 403, `Expected 403, got ${res.status}`);
  });

  await test('Non-owner cannot fund with tokens', async () => {
    const res = await api(`/api/hive-teams/${teamId}/fund-tokens`, {
      method: 'POST',
      body: JSON.stringify({ signedTransaction: 'test' }),
    });
    assert(res.status === 403, `Expected 403, got ${res.status}`);
  });

  // Restore original token
  authToken = savedToken;
}

// ============================================
// SECTION 9: CLEANUP
// ============================================

async function cleanup() {
  console.log('\n📋 CLEANUP\n');

  await test('Delete test team', async () => {
    if (!teamId) {
      console.log('   (no team to clean up)');
      return;
    }
    const res = await api(`/api/hive-teams/${teamId}`, {
      method: 'DELETE',
    });
    // Cleanup is best-effort - any response is acceptable
    // 200 = deleted, 404 = already gone, 403 = different owner, 500 = server error
    console.log(`   (cleanup returned ${res.status})`);
  });
}

// ============================================
// MAIN TEST RUNNER
// ============================================

async function runTests() {
  console.log('═══════════════════════════════════════════════');
  console.log('   HIVE E2E TEST SUITE');
  console.log('═══════════════════════════════════════════════');
  console.log(`API: ${API_BASE}`);
  console.log(`Time: ${new Date().toISOString()}\n`);

  try {
    await testAuthentication();
    await testTeamManagement();
    await testMemberManagement();
    await testFunding();
    await testDrawHistory();
    await testProposalVoting();
    await testOwnership();
    await testTeamDeletion();
  } finally {
    await cleanup();
  }

  // Summary
  console.log('\n═══════════════════════════════════════════════');
  console.log('   TEST RESULTS');
  console.log('═══════════════════════════════════════════════');
  console.log(`✅ Passed: ${results.passed}`);
  console.log(`❌ Failed: ${results.failed}`);
  console.log(`⏭️  Skipped: ${results.skipped}`);
  console.log(`📊 Total: ${results.tests.length}`);
  console.log('═══════════════════════════════════════════════\n');

  if (results.failed > 0) {
    console.log('Failed tests:');
    results.tests.filter(t => t.status === 'FAIL').forEach(t => {
      console.log(`  - ${t.name}: ${t.details}`);
    });
  }

  process.exit(results.failed > 0 ? 1 : 0);
}

runTests().catch(err => {
  console.error('Test suite crashed:', err);
  process.exit(1);
});
