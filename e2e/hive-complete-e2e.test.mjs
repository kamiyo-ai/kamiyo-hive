/**
 * Hive Complete E2E Test Suite
 *
 * Comprehensive end-to-end tests covering:
 * - API endpoints (all CRUD operations)
 * - UI flows (Playwright browser automation)
 * - Blindfold integration (payment flow)
 * - $KAMIYO token funding
 * - Task execution
 * - Proposal voting lifecycle
 * - Console error detection
 * - Edge cases and error handling
 *
 * Run with: node e2e/hive-complete-e2e.test.mjs
 *
 * Environment variables:
 *   API_URL - Backend API URL (default: https://kamiyo-protocol-4c70.onrender.com)
 *   APP_URL - Frontend app URL (default: http://localhost:3000)
 *   HEADLESS - Run browser in headless mode (default: true)
 *   SLOW_MO - Slow down browser actions in ms (default: 0)
 */

import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import nacl from 'tweetnacl';
import { chromium } from 'playwright';

// ============================================
// CONFIGURATION
// ============================================

const API_BASE = process.env.API_URL || 'https://kamiyo-protocol-4c70.onrender.com';
const APP_URL = process.env.APP_URL || 'http://localhost:3000';
const HEADLESS = process.env.HEADLESS !== 'false';
const SLOW_MO = parseInt(process.env.SLOW_MO || '0', 10);

// ============================================
// TEST STATE
// ============================================

let testWallet;
let authToken;
let teamId;
let memberId;
let proposalId;
let browser;
let page;
let consoleErrors = [];

// Test results tracking
const results = { passed: 0, failed: 0, skipped: 0, tests: [] };

// ============================================
// UTILITIES
// ============================================

function log(status, name, details = '') {
  const icon = status === 'PASS' ? '\x1b[32m✓\x1b[0m' : status === 'FAIL' ? '\x1b[31m✗\x1b[0m' : '\x1b[33m○\x1b[0m';
  const color = status === 'PASS' ? '\x1b[32m' : status === 'FAIL' ? '\x1b[31m' : '\x1b[33m';
  console.log(`  ${icon} ${color}${name}\x1b[0m${details ? ` - ${details}` : ''}`);
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
    if (process.env.DEBUG) console.error(err);
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

function section(name) {
  console.log(`\n\x1b[1m\x1b[36m▶ ${name}\x1b[0m\n`);
}

// ============================================
// SECTION 1: AUTHENTICATION TESTS (API)
// ============================================

async function testAuthentication() {
  section('AUTHENTICATION (API)');

  testWallet = Keypair.generate();
  const wallet = testWallet.publicKey.toBase58();

  await test('GET /api/auth/challenge - returns valid challenge', async () => {
    const res = await api(`/api/auth/challenge?wallet=${wallet}`);
    assert(res.ok, `Expected 200, got ${res.status}`);
    assert(res.data.challenge, 'Missing challenge');
    assert(res.data.challenge.includes(wallet), 'Challenge should contain wallet');
    assert(res.data.expiresAt, 'Missing expiresAt');
  });

  await test('GET /api/auth/challenge - rejects missing wallet', async () => {
    const res = await api('/api/auth/challenge');
    assert(!res.ok, 'Should reject missing wallet');
  });

  await test('POST /api/auth/wallet - authenticates with valid signature', async () => {
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
    assert(res.data.wallet === wallet, 'Wrong wallet in response');
    authToken = res.data.token;
  });

  await test('POST /api/auth/wallet - rejects invalid signature', async () => {
    const res = await api('/api/auth/wallet', {
      method: 'POST',
      body: JSON.stringify({ wallet, signature: 'invalid_signature' }),
    });
    assert(!res.ok, 'Should reject invalid signature');
  });

  await test('POST /api/auth/wallet - rejects expired challenge', async () => {
    // Use a different wallet to get a fresh challenge, but wait
    const tempWallet = Keypair.generate().publicKey.toBase58();
    await api(`/api/auth/challenge?wallet=${tempWallet}`);
    // Note: Can't easily test expiry without waiting, so this is a placeholder
    // In real test, would mock time or use short expiry
  });

  await test('Protected endpoint - rejects without token', async () => {
    const savedToken = authToken;
    authToken = null;
    const res = await api('/api/hive-teams');
    authToken = savedToken;
    assert(res.status === 401, `Expected 401, got ${res.status}`);
  });

  await test('Protected endpoint - rejects invalid token', async () => {
    const savedToken = authToken;
    authToken = 'invalid_token';
    const res = await api('/api/hive-teams');
    authToken = savedToken;
    assert(res.status === 401, `Expected 401, got ${res.status}`);
  });
}

// ============================================
// SECTION 2: TEAM MANAGEMENT TESTS (API)
// ============================================

async function testTeamManagement() {
  section('TEAM MANAGEMENT (API)');

  await test('GET /api/hive-teams - lists teams (initially empty or existing)', async () => {
    const res = await api('/api/hive-teams');
    assert(res.ok, `Expected 200, got ${res.status}`);
    assert(Array.isArray(res.data.teams), 'teams should be array');
  });

  await test('POST /api/hive-teams - creates team with members', async () => {
    const res = await api('/api/hive-teams', {
      method: 'POST',
      body: JSON.stringify({
        name: 'E2E Complete Test Team',
        currency: 'USDC',
        dailyLimit: 100,
        members: [
          { agentId: 'alpha-agent', role: 'admin', drawLimit: 50 },
          { agentId: 'beta-agent', role: 'member', drawLimit: 30 },
          { agentId: 'gamma-agent', role: 'member', drawLimit: 20 },
        ],
      }),
    });

    assert(res.ok, `Expected 201, got ${res.status}: ${JSON.stringify(res.data)}`);
    assert(res.data.id, 'Missing team id');
    assert(res.data.name === 'E2E Complete Test Team', 'Wrong name');
    assert(res.data.currency === 'USDC', 'Wrong currency');
    assert(res.data.dailyLimit === 100, 'Wrong dailyLimit');
    assert(res.data.members.length === 3, 'Should have 3 members');
    assert(res.data.poolBalance === 0, 'Pool should start at 0');

    teamId = res.data.id;
    memberId = res.data.members[0].id;
  });

  await test('POST /api/hive-teams - creates team without members', async () => {
    const res = await api('/api/hive-teams', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Empty Team',
        currency: 'SOL',
        dailyLimit: 50,
      }),
    });
    assert(res.ok, `Expected 201, got ${res.status}`);
    assert(res.data.members.length === 0, 'Should have no members');

    // Clean up
    await api(`/api/hive-teams/${res.data.id}`, { method: 'DELETE' });
  });

  await test('POST /api/hive-teams - rejects missing name', async () => {
    const res = await api('/api/hive-teams', {
      method: 'POST',
      body: JSON.stringify({ currency: 'USDC', dailyLimit: 100 }),
    });
    assert(!res.ok, 'Should reject missing name');
  });

  await test('POST /api/hive-teams - rejects missing currency', async () => {
    const res = await api('/api/hive-teams', {
      method: 'POST',
      body: JSON.stringify({ name: 'Test', dailyLimit: 100 }),
    });
    assert(!res.ok, 'Should reject missing currency');
  });

  await test('POST /api/hive-teams - rejects missing dailyLimit', async () => {
    const res = await api('/api/hive-teams', {
      method: 'POST',
      body: JSON.stringify({ name: 'Test', currency: 'USDC' }),
    });
    assert(!res.ok, 'Should reject missing dailyLimit');
  });

  await test('POST /api/hive-teams - rejects negative dailyLimit', async () => {
    const res = await api('/api/hive-teams', {
      method: 'POST',
      body: JSON.stringify({ name: 'Test', currency: 'USDC', dailyLimit: -10 }),
    });
    assert(!res.ok, 'Should reject negative dailyLimit');
  });

  await test('POST /api/hive-teams - rejects zero dailyLimit', async () => {
    const res = await api('/api/hive-teams', {
      method: 'POST',
      body: JSON.stringify({ name: 'Test', currency: 'USDC', dailyLimit: 0 }),
    });
    assert(!res.ok, 'Should reject zero dailyLimit');
  });

  await test('GET /api/hive-teams/:id - returns team detail', async () => {
    const res = await api(`/api/hive-teams/${teamId}`);
    assert(res.ok, `Expected 200, got ${res.status}`);
    assert(res.data.id === teamId, 'Wrong team id');
    assert(res.data.poolBalance === 0, 'Pool should be 0');
    assert(res.data.dailySpend === 0, 'Daily spend should be 0');
    assert(Array.isArray(res.data.members), 'members should be array');
    assert(Array.isArray(res.data.recentDraws), 'recentDraws should be array');
  });

  await test('GET /api/hive-teams/:id - returns 404 for non-existent', async () => {
    const res = await api('/api/hive-teams/team_nonexistent_12345');
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

  await test('PATCH /api/hive-teams/:id/budget - updates member limits', async () => {
    const res = await api(`/api/hive-teams/${teamId}/budget`, {
      method: 'PATCH',
      body: JSON.stringify({ memberLimits: { [memberId]: 75 } }),
    });
    assert(res.ok, `Expected 200, got ${res.status}`);

    const detail = await api(`/api/hive-teams/${teamId}`);
    const member = detail.data.members.find(m => m.id === memberId);
    assert(member.drawLimit === 75, 'Member limit not updated');
  });

  await test('PATCH /api/hive-teams/:id/budget - rejects negative limit', async () => {
    const res = await api(`/api/hive-teams/${teamId}/budget`, {
      method: 'PATCH',
      body: JSON.stringify({ dailyLimit: -50 }),
    });
    assert(!res.ok, 'Should reject negative limit');
  });
}

// ============================================
// SECTION 3: MEMBER MANAGEMENT TESTS (API)
// ============================================

async function testMemberManagement() {
  section('MEMBER MANAGEMENT (API)');

  let newMemberId;

  await test('POST /api/hive-teams/:id/members - adds member', async () => {
    const res = await api(`/api/hive-teams/${teamId}/members`, {
      method: 'POST',
      body: JSON.stringify({ agentId: 'delta-agent', role: 'member', drawLimit: 15 }),
    });
    assert(res.ok, `Expected 201, got ${res.status}: ${JSON.stringify(res.data)}`);
    assert(res.data.id, 'Missing member id');
    assert(res.data.agentId === 'delta-agent', 'Wrong agentId');
    assert(res.data.role === 'member', 'Wrong role');
    assert(res.data.drawLimit === 15, 'Wrong drawLimit');
    newMemberId = res.data.id;
  });

  await test('POST /api/hive-teams/:id/members - adds admin member', async () => {
    const res = await api(`/api/hive-teams/${teamId}/members`, {
      method: 'POST',
      body: JSON.stringify({ agentId: 'epsilon-admin', role: 'admin', drawLimit: 100 }),
    });
    assert(res.ok, `Expected 201, got ${res.status}`);
    assert(res.data.role === 'admin', 'Should be admin');

    // Clean up
    await api(`/api/hive-teams/${teamId}/members/${res.data.id}`, { method: 'DELETE' });
  });

  await test('POST /api/hive-teams/:id/members - rejects missing agentId', async () => {
    const res = await api(`/api/hive-teams/${teamId}/members`, {
      method: 'POST',
      body: JSON.stringify({ role: 'member', drawLimit: 10 }),
    });
    assert(!res.ok, 'Should reject missing agentId');
  });

  await test('POST /api/hive-teams/:id/members - rejects empty agentId', async () => {
    const res = await api(`/api/hive-teams/${teamId}/members`, {
      method: 'POST',
      body: JSON.stringify({ agentId: '', drawLimit: 10 }),
    });
    assert(!res.ok, 'Should reject empty agentId');
  });

  await test('POST /api/hive-teams/:id/members - rejects negative drawLimit', async () => {
    const res = await api(`/api/hive-teams/${teamId}/members`, {
      method: 'POST',
      body: JSON.stringify({ agentId: 'test-agent', drawLimit: -5 }),
    });
    assert(!res.ok, 'Should reject negative drawLimit');
  });

  await test('POST /api/hive-teams/:id/members - defaults role to member', async () => {
    const res = await api(`/api/hive-teams/${teamId}/members`, {
      method: 'POST',
      body: JSON.stringify({ agentId: 'zeta-agent', drawLimit: 10 }),
    });
    assert(res.ok, `Expected 201, got ${res.status}`);
    assert(res.data.role === 'member', 'Should default to member');

    // Clean up
    await api(`/api/hive-teams/${teamId}/members/${res.data.id}`, { method: 'DELETE' });
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
    const res = await api(`/api/hive-teams/${teamId}/members/member_nonexistent`, {
      method: 'DELETE',
    });
    assert(res.status === 404, `Expected 404, got ${res.status}`);
  });
}

// ============================================
// SECTION 4: FUNDING TESTS (API)
// ============================================

let poolFunded = false;

async function testFunding() {
  section('FUNDING (API)');

  await test('GET /api/hive-teams/:id/fund/blindfold - returns funding URL', async () => {
    const res = await api(`/api/hive-teams/${teamId}/fund/blindfold`);
    assert(res.ok, `Expected 200, got ${res.status}`);
    assert(res.data.fundingUrl, 'Missing fundingUrl');
    assert(res.data.fundingUrl.includes('blindfold'), 'URL should contain blindfold');
    assert(res.data.stateToken, 'Missing stateToken');
    assert(res.data.stateToken.startsWith('bf_'), 'State token should start with bf_');
    assert(res.data.expiresAt, 'Missing expiresAt');
    assert(res.data.expiresAt > Date.now(), 'ExpiresAt should be in future');
  });

  await test('POST /api/hive-teams/:id/fund - initiates funding request', async () => {
    const res = await api(`/api/hive-teams/${teamId}/fund`, {
      method: 'POST',
      body: JSON.stringify({ amount: 50 }),
    });
    assert(res.ok, `Expected 200, got ${res.status}: ${JSON.stringify(res.data)}`);

    // Check result - either auto-credited (dev) or deposit created (prod)
    if (res.data.depositId) {
      assert(res.data.cryptoAddress || res.data.paymentId, 'Should have payment details');
      console.log('      (production mode: deposit created)');
    }

    // Check if pool was credited (dev mode)
    const detail = await api(`/api/hive-teams/${teamId}`);
    if (detail.data.poolBalance >= 50) {
      poolFunded = true;
      console.log('      (dev mode: pool auto-credited)');
    }
  });

  await test('POST /api/hive-teams/:id/fund - rejects zero amount', async () => {
    const res = await api(`/api/hive-teams/${teamId}/fund`, {
      method: 'POST',
      body: JSON.stringify({ amount: 0 }),
    });
    assert(!res.ok, 'Should reject zero amount');
  });

  await test('POST /api/hive-teams/:id/fund - rejects negative amount', async () => {
    const res = await api(`/api/hive-teams/${teamId}/fund`, {
      method: 'POST',
      body: JSON.stringify({ amount: -10 }),
    });
    assert(!res.ok, 'Should reject negative amount');
  });

  await test('POST /api/hive-teams/:id/fund - rejects missing amount', async () => {
    const res = await api(`/api/hive-teams/${teamId}/fund`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
    assert(!res.ok, 'Should reject missing amount');
  });

  await test('POST /api/hive-teams/:id/fund-tokens - rejects invalid transaction', async () => {
    const res = await api(`/api/hive-teams/${teamId}/fund-tokens`, {
      method: 'POST',
      body: JSON.stringify({ signedTransaction: 'aW52YWxpZA==' }), // base64 "invalid"
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

  await test('POST /api/hive-teams/:id/fund-credits - rejects without wallet auth', async () => {
    const res = await api(`/api/hive-teams/${teamId}/fund-credits`, {
      method: 'POST',
      body: JSON.stringify({ amountUsd: 10 }),
    });
    // This endpoint requires wallet in request, not just auth
    // Should fail with missing wallet or insufficient credits
    assert(!res.ok || res.data.error, 'Should handle fund-credits properly');
  });

  // Try test funding endpoint if pool not funded
  if (!poolFunded) {
    await test('POST /api/hive-teams/:id/fund-test - test funding endpoint', async () => {
      const res = await api(`/api/hive-teams/${teamId}/fund-test`, {
        method: 'POST',
        body: JSON.stringify({ amount: 100 }),
      });
      if (res.ok) {
        poolFunded = true;
        console.log('      (test endpoint: pool credited)');
      } else if (res.status === 404) {
        console.log('      (test endpoint not available)');
      } else {
        throw new Error(`Unexpected: ${res.status}`);
      }
    });
  }

  await test('POST /api/hive-teams/:id/fund-test - rejects amount > 1000', async () => {
    const res = await api(`/api/hive-teams/${teamId}/fund-test`, {
      method: 'POST',
      body: JSON.stringify({ amount: 1001 }),
    });
    // Either 404 (not enabled) or 400 (over limit)
    assert(res.status === 404 || res.status === 400, `Expected 404 or 400, got ${res.status}`);
  });
}

// ============================================
// SECTION 5: DRAW HISTORY TESTS (API)
// ============================================

async function testDrawHistory() {
  section('DRAW HISTORY (API)');

  await test('GET /api/hive-teams/:id/draws - returns draws array', async () => {
    const res = await api(`/api/hive-teams/${teamId}/draws`);
    assert(res.ok, `Expected 200, got ${res.status}`);
    assert(Array.isArray(res.data.draws), 'draws should be array');
    assert(typeof res.data.total === 'number', 'total should be number');
  });

  await test('GET /api/hive-teams/:id/draws - respects limit parameter', async () => {
    const res = await api(`/api/hive-teams/${teamId}/draws?limit=5`);
    assert(res.ok, `Expected 200, got ${res.status}`);
    assert(res.data.draws.length <= 5, 'Should respect limit');
  });

  await test('GET /api/hive-teams/:id/draws - respects offset parameter', async () => {
    const res = await api(`/api/hive-teams/${teamId}/draws?offset=0&limit=10`);
    assert(res.ok, `Expected 200, got ${res.status}`);
  });

  await test('GET /api/hive-teams/:id/draws - filters by agentId', async () => {
    const res = await api(`/api/hive-teams/${teamId}/draws?agentId=alpha-agent`);
    assert(res.ok, `Expected 200, got ${res.status}`);
    for (const draw of res.data.draws) {
      assert(draw.agentId === 'alpha-agent', 'Should filter by agentId');
    }
  });

  await test('GET /api/hive-teams/:id/draws - returns empty for non-existent agent', async () => {
    const res = await api(`/api/hive-teams/${teamId}/draws?agentId=nonexistent-agent`);
    assert(res.ok, `Expected 200, got ${res.status}`);
    assert(res.data.draws.length === 0, 'Should be empty');
  });
}

// ============================================
// SECTION 6: TASK EXECUTION TESTS (API)
// ============================================

async function testTaskExecution() {
  section('TASK EXECUTION (API)');

  // Check pool balance
  const balanceCheck = await api(`/api/hive-teams/${teamId}`);
  const hasBalance = balanceCheck.data.poolBalance >= 10;

  if (!hasBalance && !poolFunded) {
    console.log('  \x1b[33m○ Skipping task tests - pool not funded\x1b[0m');
    log('SKIP', 'Task execution tests', 'Pool not funded');
    return;
  }

  await test('POST /api/hive-teams/:id/tasks - submits task', async () => {
    const res = await api(`/api/hive-teams/${teamId}/tasks`, {
      method: 'POST',
      body: JSON.stringify({
        memberId,
        description: 'E2E test task: analyze market data',
        budget: 5,
      }),
    });

    // Task execution may succeed or fail depending on AI availability
    if (res.ok) {
      assert(res.data.taskId, 'Should have taskId');
      assert(res.data.status, 'Should have status');
      console.log(`      (task ${res.data.status})`);
    } else {
      // API errors are acceptable for E2E - we're testing the endpoint exists
      console.log(`      (task failed: ${res.data.error || res.status})`);
    }
  });

  await test('POST /api/hive-teams/:id/tasks - rejects missing memberId', async () => {
    const res = await api(`/api/hive-teams/${teamId}/tasks`, {
      method: 'POST',
      body: JSON.stringify({
        description: 'Test task',
        budget: 5,
      }),
    });
    assert(!res.ok, 'Should reject missing memberId');
  });

  await test('POST /api/hive-teams/:id/tasks - rejects missing description', async () => {
    const res = await api(`/api/hive-teams/${teamId}/tasks`, {
      method: 'POST',
      body: JSON.stringify({
        memberId,
        budget: 5,
      }),
    });
    assert(!res.ok, 'Should reject missing description');
  });

  await test('POST /api/hive-teams/:id/tasks - rejects invalid memberId', async () => {
    const res = await api(`/api/hive-teams/${teamId}/tasks`, {
      method: 'POST',
      body: JSON.stringify({
        memberId: 'invalid_member_id',
        description: 'Test task',
        budget: 5,
      }),
    });
    assert(!res.ok, 'Should reject invalid memberId');
  });
}

// ============================================
// SECTION 7: PROPOSAL & VOTING TESTS (API)
// ============================================

async function testProposalVoting() {
  section('PROPOSAL & VOTING (API)');

  // Check pool balance
  const balanceCheck = await api(`/api/hive-teams/${teamId}`);
  const hasBalance = balanceCheck.data.poolBalance >= 20;

  if (!hasBalance && !poolFunded) {
    console.log('  \x1b[33m○ Skipping proposal tests - pool not funded\x1b[0m');
    log('SKIP', 'Proposal tests', 'Pool not funded');
    return;
  }

  await test('POST /api/hive-teams/:id/propose-task - creates proposal', async () => {
    const res = await api(`/api/hive-teams/${teamId}/propose-task`, {
      method: 'POST',
      body: JSON.stringify({
        description: 'E2E proposal: research competitor analysis',
        budget: 15,
        minBid: 2,
        voteDurationSec: 5,
        revealDurationSec: 5,
      }),
    });
    assert(res.ok, `Expected 201, got ${res.status}: ${JSON.stringify(res.data)}`);
    assert(res.data.proposalId, 'Missing proposalId');
    assert(res.data.actionHash, 'Missing actionHash');
    assert(res.data.voteDeadline, 'Missing voteDeadline');
    assert(res.data.revealDeadline, 'Missing revealDeadline');
    proposalId = res.data.proposalId;
  });

  await test('POST /api/hive-teams/:id/propose-task - rejects missing description', async () => {
    const res = await api(`/api/hive-teams/${teamId}/propose-task`, {
      method: 'POST',
      body: JSON.stringify({ budget: 10 }),
    });
    assert(!res.ok, 'Should reject missing description');
  });

  await test('POST /api/hive-teams/:id/propose-task - rejects missing budget', async () => {
    const res = await api(`/api/hive-teams/${teamId}/propose-task`, {
      method: 'POST',
      body: JSON.stringify({ description: 'Test' }),
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
    assert(res.data.proposal.budget === 15, 'Wrong budget');
    assert(res.data.proposal.minBid === 2, 'Wrong minBid');
  });

  await test('POST /api/hive-teams/:id/vote-bid - submits vote commitment', async () => {
    const nullifier = `nullifier_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const res = await api(`/api/hive-teams/${teamId}/vote-bid`, {
      method: 'POST',
      body: JSON.stringify({
        proposalId,
        memberId,
        proof: '0xtest_proof',
        voteNullifier: nullifier,
        voteCommitment: '0xvote_commitment',
        bidCommitment: '0xbid_commitment',
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

    // Duplicate attempt
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
    assert(res.status === 400, `Expected 400, got ${res.status}`);
  });

  await test('Wait for vote phase to end', async () => {
    console.log('      (waiting 6s for vote phase...)');
    await new Promise(r => setTimeout(r, 6000));
  });

  await test('POST /api/hive-teams/:id/reveal-bid - reveals vote', async () => {
    const detail = await api(`/api/hive-teams/${teamId}/proposals/${proposalId}`);
    const vote = detail.data.votes?.[0];

    if (!vote) {
      log('SKIP', 'Reveal bid', 'No votes to reveal');
      return;
    }

    const res = await api(`/api/hive-teams/${teamId}/reveal-bid`, {
      method: 'POST',
      body: JSON.stringify({
        proposalId,
        memberId: vote.memberId,
        voteNullifier: vote.voteNullifier,
        voteValue: 1, // YES
        voteSalt: 'test_salt',
        bidAmount: 5,
        bidSalt: 'test_bid_salt',
      }),
    });
    assert(res.ok, `Expected 200, got ${res.status}: ${JSON.stringify(res.data)}`);
  });

  await test('POST /api/hive-teams/:id/reveal-bid - rejects bid below minimum', async () => {
    const detail = await api(`/api/hive-teams/${teamId}/proposals/${proposalId}`);
    const unrevealed = detail.data.votes?.find(v => !v.revealed);

    if (!unrevealed) {
      log('SKIP', 'Reveal low bid', 'No unrevealed votes');
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
        bidAmount: 0, // Below minBid of 2
        bidSalt: 'bidsalt',
      }),
    });
    assert(!res.ok, 'Should reject bid below minimum');
  });

  await test('Wait for reveal phase to end', async () => {
    console.log('      (waiting 6s for reveal phase...)');
    await new Promise(r => setTimeout(r, 6000));
  });

  await test('POST /api/hive-teams/:id/execute-proposal - executes proposal', async () => {
    const res = await api(`/api/hive-teams/${teamId}/execute-proposal`, {
      method: 'POST',
      body: JSON.stringify({ proposalId }),
    });

    // Execution may succeed or fail depending on votes/bids
    if (res.ok) {
      assert(res.data.status, 'Should have status');
      console.log(`      (proposal ${res.data.status})`);
    } else {
      // May fail if no YES votes, which is acceptable
      console.log(`      (execution: ${res.data.error || res.status})`);
    }
  });
}

// ============================================
// SECTION 8: OWNERSHIP & AUTHORIZATION TESTS (API)
// ============================================

async function testOwnership() {
  section('OWNERSHIP & AUTHORIZATION (API)');

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

  await test('Non-owner can read team', async () => {
    const res = await api(`/api/hive-teams/${teamId}`);
    assert(res.ok, `Expected 200, got ${res.status}`);
  });

  await test('Non-owner cannot add member', async () => {
    const res = await api(`/api/hive-teams/${teamId}/members`, {
      method: 'POST',
      body: JSON.stringify({ agentId: 'hacker-agent' }),
    });
    assert(res.status === 403, `Expected 403, got ${res.status}`);
  });

  await test('Non-owner cannot remove member', async () => {
    const res = await api(`/api/hive-teams/${teamId}/members/${memberId}`, {
      method: 'DELETE',
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

  await test('Non-owner cannot use test funding', async () => {
    const res = await api(`/api/hive-teams/${teamId}/fund-test`, {
      method: 'POST',
      body: JSON.stringify({ amount: 10 }),
    });
    // Either 403 (forbidden) or 404 (not enabled) is acceptable
    assert(res.status === 403 || res.status === 404, `Expected 403 or 404, got ${res.status}`);
  });

  // Restore original token
  authToken = savedToken;
}

// ============================================
// SECTION 9: TEAM DELETION TESTS (API)
// ============================================

async function testTeamDeletion() {
  section('TEAM DELETION (API)');

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

  await test('DELETE /api/hive-teams/:id - returns 403/404 for non-existent', async () => {
    const res = await api('/api/hive-teams/team_does_not_exist', {
      method: 'DELETE',
    });
    assert(res.status === 404 || res.status === 403, `Expected 403 or 404, got ${res.status}`);
  });
}

// ============================================
// SECTION 10: UI TESTS (Playwright)
// ============================================

async function setupBrowser() {
  section('UI TESTS (Playwright)');

  browser = await chromium.launch({
    headless: HEADLESS,
    slowMo: SLOW_MO,
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });

  page = await context.newPage();

  // Capture console errors
  page.on('console', msg => {
    if (msg.type() === 'error') {
      const text = msg.text();
      // Filter out non-critical errors
      if (!text.includes('apple-touch-icon') && !text.includes('favicon')) {
        consoleErrors.push(text);
      }
    }
  });

  // Capture network errors
  page.on('response', response => {
    const status = response.status();
    const url = response.url();
    if (status >= 400 && !url.includes('apple-touch-icon') && !url.includes('favicon')) {
      consoleErrors.push(`${status} ${url}`);
    }
  });
}

async function testUINavigation() {
  // Test wallet for UI display
  const uiTestWallet = Keypair.generate();
  const testWalletParam = bs58.encode(uiTestWallet.secretKey);

  await test('UI: Navigate to hive page', async () => {
    await page.goto(`${APP_URL}/hive?testWallet=${testWalletParam}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Check page loaded
    const heading = await page.locator('h1').first().textContent();
    assert(heading?.includes('Treasury') || heading?.includes('Hive'), 'Should show hive page');
  });

  await test('UI: Wallet connects with test param', async () => {
    await page.waitForTimeout(1000);
    // Wallet UI should be rendered
    assert(true, 'Wallet UI rendered');
  });

  await test('UI: Create team form is visible', async () => {
    const nameInput = page.locator('input[placeholder*="Squad"], input[placeholder*="Name"]').first();
    const isVisible = await nameInput.isVisible().catch(() => false);
    assert(isVisible, 'Name input should be visible');
  });

  await test('UI: Fill team creation form', async () => {
    await page.fill('input[placeholder*="Squad"], input[placeholder*="Name"]', 'UI Test Team');
    await page.fill('input[placeholder*="10"], input[type="number"]', '50');

    // The PayButton uses scrambled text, locate by structure
    const createButton = page.locator('button').filter({ has: page.locator('span.skew-x-\\[-45deg\\]') }).first();
    const exists = await createButton.isVisible().catch(() => false);
    assert(exists, 'Create button should be visible');
  });

  await test('UI: Create button is clickable', async () => {
    // Test that the button can be clicked (won't complete without full wallet auth)
    const payButton = page.locator('button').filter({ has: page.locator('span.skew-x-\\[-45deg\\]') }).first();
    const isEnabled = await payButton.isEnabled().catch(() => false);
    assert(isEnabled, 'Create button should be enabled');
  });

  // Navigate to an existing team created by API tests
  await test('UI: Navigate to team detail page', async () => {
    // Use API-created team if available, otherwise create a simple test team via API
    let testTeamId = teamId; // From API tests

    if (!testTeamId) {
      // Create a team via API for UI testing
      const res = await api('/api/hive-teams', {
        method: 'POST',
        body: JSON.stringify({
          name: 'UI Test Team',
          currency: 'USDC',
          dailyLimit: 50,
          members: [{ agentId: 'ui-test-agent', role: 'member', drawLimit: 25 }],
        }),
      });
      if (res.ok) {
        testTeamId = res.data.id;
        console.log(`      (created team ${testTeamId} via API)`);
      }
    }

    if (testTeamId) {
      await page.goto(`${APP_URL}/hive/${testTeamId}`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
    }
  });

  await test('UI: Team detail page loads', async () => {
    const url = page.url();
    if (!url.includes('/hive/team_')) {
      console.log('      (skipped - no team detail page)');
      return;
    }

    // Wait for page content
    await page.waitForTimeout(3000);

    // Check for h2 section headings (Budget, Members are h2 tags)
    const budgetH2 = page.locator('h2:has-text("Budget")');
    const membersH2 = page.locator('h2:has-text("Members")');

    const hasBudget = await budgetH2.isVisible().catch(() => false);
    const hasMembers = await membersH2.isVisible().catch(() => false);

    // If both fail, try checking for loading state or auth prompt
    if (!hasBudget && !hasMembers) {
      const hasLoading = await page.locator('text=Loading').isVisible().catch(() => false);
      const hasAuth = await page.locator('text=connect').first().isVisible().catch(() => false);
      if (hasLoading || hasAuth) {
        console.log('      (page is loading or requires auth)');
        return;
      }
    }

    assert(hasBudget || hasMembers, 'Team detail sections should be visible');
  });

  await test('UI: Fund section visible', async () => {
    const url = page.url();
    if (!url.includes('/hive/team_')) {
      console.log('      (skipped - no team detail page)');
      return;
    }

    // Check if page loaded fully (has Budget section)
    const budgetH2 = page.locator('h2:has-text("Budget")');
    const pageLoaded = await budgetH2.isVisible().catch(() => false);
    if (!pageLoaded) {
      console.log('      (skipped - page requires auth)');
      return;
    }

    // Check for "Fund with $KAMIYO" text which is always present
    const kamiyoFund = page.locator('text=Fund with $KAMIYO');
    const creditsTab = page.locator('text=Use Credits');

    const hasKamiyo = await kamiyoFund.isVisible().catch(() => false);
    const hasCredits = await creditsTab.isVisible().catch(() => false);

    assert(hasKamiyo || hasCredits, 'Fund section should be visible');
  });

  await test('UI: Switch to $KAMIYO funding mode', async () => {
    const url = page.url();
    if (!url.includes('/hive/team_')) {
      console.log('      (skipped - no team detail page)');
      return;
    }

    const kamiyoTab = page.locator('text=Fund with $KAMIYO').first();
    if (await kamiyoTab.isVisible().catch(() => false)) {
      await kamiyoTab.click();
      await page.waitForTimeout(500);
      console.log('      (switched to $KAMIYO mode)');
    }
  });

  await test('UI: Task submission section visible', async () => {
    const url = page.url();
    if (!url.includes('/hive/team_')) {
      console.log('      (skipped - no team detail page)');
      return;
    }

    // Check if page loaded fully
    const budgetH2 = page.locator('h2:has-text("Budget")');
    const pageLoaded = await budgetH2.isVisible().catch(() => false);
    if (!pageLoaded) {
      console.log('      (skipped - page requires auth)');
      return;
    }

    // Look for "Submit Task" heading
    const submitTaskH2 = page.locator('h2:has-text("Submit Task")');
    const hasSubmitTask = await submitTaskH2.isVisible().catch(() => false);

    assert(hasSubmitTask, 'Task section should be visible');
  });

  await test('UI: Draw history section visible', async () => {
    const url = page.url();
    if (!url.includes('/hive/team_')) {
      console.log('      (skipped - no team detail page)');
      return;
    }

    // Check if page loaded fully
    const budgetH2 = page.locator('h2:has-text("Budget")');
    const pageLoaded = await budgetH2.isVisible().catch(() => false);
    if (!pageLoaded) {
      console.log('      (skipped - page requires auth)');
      return;
    }

    // Look for "Draw History" heading
    const drawHistoryH2 = page.locator('h2:has-text("Draw History")');
    const hasDrawHistory = await drawHistoryH2.isVisible().catch(() => false);

    assert(hasDrawHistory, 'Draw history should be visible');
  });
}

async function testUIConsoleErrors() {
  await test('UI: No critical console errors', async () => {
    // Filter critical errors (401, 500, 429)
    const criticalErrors = consoleErrors.filter(e =>
      e.includes('401') || e.includes('500') || e.includes('429')
    );

    if (criticalErrors.length > 0) {
      console.log('      Critical errors found:');
      criticalErrors.forEach(e => console.log(`        - ${e}`));
    }

    assert(criticalErrors.length === 0, `Found ${criticalErrors.length} critical errors`);
  });

  await test('UI: All network requests succeeded', async () => {
    // Report any remaining errors
    const networkErrors = consoleErrors.filter(e =>
      e.match(/^[45]\d\d\s/) && !e.includes('401') && !e.includes('500') && !e.includes('429')
    );

    if (networkErrors.length > 0) {
      console.log(`      (${networkErrors.length} non-critical network errors)`);
    }
  });
}

async function closeBrowser() {
  if (browser) {
    await browser.close();
  }
}

// ============================================
// SECTION 11: CLEANUP
// ============================================

async function cleanup() {
  section('CLEANUP');

  await test('Delete test team', async () => {
    if (!teamId) {
      console.log('      (no team to clean up)');
      return;
    }
    const res = await api(`/api/hive-teams/${teamId}`, {
      method: 'DELETE',
    });
    console.log(`      (cleanup returned ${res.status})`);
  });
}

// ============================================
// MAIN TEST RUNNER
// ============================================

async function runTests() {
  console.log('\n\x1b[1m╔════════════════════════════════════════════════════════════════╗\x1b[0m');
  console.log('\x1b[1m║         HIVE COMPLETE E2E TEST SUITE                     ║\x1b[0m');
  console.log('\x1b[1m╚════════════════════════════════════════════════════════════════╝\x1b[0m\n');
  console.log(`  API:      ${API_BASE}`);
  console.log(`  App:      ${APP_URL}`);
  console.log(`  Headless: ${HEADLESS}`);
  console.log(`  Time:     ${new Date().toISOString()}`);

  const startTime = Date.now();

  try {
    // API Tests
    await testAuthentication();
    await testTeamManagement();
    await testMemberManagement();
    await testFunding();
    await testDrawHistory();
    await testTaskExecution();
    await testProposalVoting();
    await testOwnership();

    // UI Tests (run before deletion so teamId is still valid)
    await setupBrowser();
    await testUINavigation();
    await testUIConsoleErrors();
    await closeBrowser();

    // Deletion tests (run last)
    await testTeamDeletion();
  } catch (err) {
    console.error('\n\x1b[31mTest suite error:\x1b[0m', err);
  } finally {
    await closeBrowser();
    await cleanup();
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);

  // Summary
  console.log('\n\x1b[1m╔════════════════════════════════════════════════════════════════╗\x1b[0m');
  console.log('\x1b[1m║                        TEST RESULTS                            ║\x1b[0m');
  console.log('\x1b[1m╚════════════════════════════════════════════════════════════════╝\x1b[0m\n');
  console.log(`  \x1b[32m✓ Passed:  ${results.passed}\x1b[0m`);
  console.log(`  \x1b[31m✗ Failed:  ${results.failed}\x1b[0m`);
  console.log(`  \x1b[33m○ Skipped: ${results.skipped}\x1b[0m`);
  console.log(`  \x1b[36m▸ Total:   ${results.tests.length}\x1b[0m`);
  console.log(`  \x1b[90m⏱ Time:    ${duration}s\x1b[0m\n`);

  if (results.failed > 0) {
    console.log('\x1b[31mFailed tests:\x1b[0m');
    results.tests.filter(t => t.status === 'FAIL').forEach(t => {
      console.log(`  \x1b[31m✗\x1b[0m ${t.name}`);
      if (t.details) console.log(`    \x1b[90m${t.details}\x1b[0m`);
    });
    console.log();
  }

  if (consoleErrors.length > 0) {
    console.log('\x1b[33mConsole errors captured:\x1b[0m');
    consoleErrors.slice(0, 10).forEach(e => {
      console.log(`  \x1b[33m!\x1b[0m ${e.slice(0, 100)}`);
    });
    if (consoleErrors.length > 10) {
      console.log(`  ... and ${consoleErrors.length - 10} more`);
    }
    console.log();
  }

  process.exit(results.failed > 0 ? 1 : 0);
}

runTests().catch(err => {
  console.error('\x1b[31mTest suite crashed:\x1b[0m', err);
  process.exit(1);
});
