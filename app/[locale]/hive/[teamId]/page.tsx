'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useParams } from 'next/navigation';
import { useWallet } from '@solana/wallet-adapter-react';
import { useConnection } from '@solana/wallet-adapter-react';
import { PublicKey, Transaction } from '@solana/web3.js';
import { getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, createTransferCheckedInstruction, getAccount, TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import PayButton from '@/components/PayButton';
import { useRouter } from 'next/navigation';
import {
  getTeam, addMember, removeMember, updateBudget, getDraws,
  initiateFunding, confirmFunding, fundWithTokens, submitTask, deleteTeam,
  ensureAuthenticated, getBlindfoldFundingUrl,
  HiveTeamDetail, HiveDraw, FundDeposit, TaskResult,
} from '@/lib/hive-api';

const KAMIYO_MINT = new PublicKey('Gy55EJmheLyDXiZ7k7CW2FhunD1UgjQxQibuBn3Npump');
const KAMIYO_DECIMALS = 6;
// Treasury wallet that receives the tokens for the hive pool
const HIVE_TREASURY = new PublicKey('F7ZxVjxGvirpvkbcF8HUMofR81TkjHqKKS6ABxQYeEtV');

const EXAMPLE_TASKS: Record<string, { agent: string; task: string }[]> = {
  'Trading Desk': [
    { agent: 'arb-agent', task: 'Monitor SOL/USDC spread across Jupiter, Raydium, and Orca. Execute arbitrage when spread exceeds 0.3%' },
    { agent: 'market-maker', task: 'Place limit orders at 0.5% spread on SOL/USDC pair. Rebalance inventory when position exceeds 60% one side' },
    { agent: 'trend-follower', task: 'Analyze 4h candles for SOL. Enter long if price breaks above 20-day MA with volume confirmation' },
  ],
  'Content Studio': [
    { agent: 'writer', task: 'Write a 800-word blog post about the latest Solana DeFi trends. Include 3 project spotlights with on-chain data' },
    { agent: 'editor', task: 'Review and fact-check the draft blog post. Verify all statistics and add relevant links to sources' },
    { agent: 'publisher', task: 'Format post for Medium and Twitter thread. Schedule publication for 9am EST and create promotional graphics' },
  ],
  'Research Cluster': [
    { agent: 'scraper', task: 'Collect all token launches on pump.fun in the last 24h. Extract creator wallets, initial liquidity, and holder distribution' },
    { agent: 'analyst', task: 'Score the top 20 new tokens by whale concentration, dev wallet activity, and social sentiment. Flag any rug pull indicators' },
    { agent: 'reporter', task: 'Compile findings into a daily alpha report. Highlight top 3 opportunities and top 3 warnings with supporting evidence' },
  ],
  'DevOps Hive': [
    { agent: 'monitor', task: 'Check RPC endpoint latency and error rates. Alert if p95 latency exceeds 500ms or error rate exceeds 1%' },
    { agent: 'fixer', task: 'Investigate the failed transaction batch from 14:00 UTC. Retry with higher priority fee if network congestion was the cause' },
    { agent: 'deployer', task: 'Deploy the updated price oracle to devnet. Run integration tests and prepare mainnet deployment PR for review' },
  ],
};


function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    completed: 'text-[#00f0ff] border-[#00f0ff]/30',
    processing: 'text-yellow-400 border-yellow-400/30',
    pending: 'text-gray-400 border-gray-500/30',
    failed: 'text-red-400 border-red-400/30',
  };
  const cls = colors[status] || colors.pending;
  return (
    <span className={`text-xs border rounded px-2 py-0.5 ${cls}`}>
      {status}
    </span>
  );
}

export default function TeamDetailPage() {
  const params = useParams();
  const router = useRouter();
  const wallet = useWallet();
  const { publicKey, signTransaction } = wallet;
  const { connection } = useConnection();
  const teamId = params.teamId as string;

  const [team, setTeam] = useState<HiveTeamDetail | null>(null);
  const [draws, setDraws] = useState<HiveDraw[]>([]);
  const [drawsTotal, setDrawsTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  // Form state
  const [fundAmount, setFundAmount] = useState('');
  const [newAgentId, setNewAgentId] = useState('');
  const [newRole, setNewRole] = useState('member');
  const [newDrawLimit, setNewDrawLimit] = useState('');
  const [editingLimit, setEditingLimit] = useState<string | null>(null);
  const [editLimitValue, setEditLimitValue] = useState('');
  const [editingDailyLimit, setEditingDailyLimit] = useState(false);
  const [dailyLimitValue, setDailyLimitValue] = useState('');

  // Fund deposit state
  const [fundMode, setFundMode] = useState<'crypto' | 'credits' | 'blindfold'>('credits');
  const [fundingDeposit, setFundingDeposit] = useState<FundDeposit | null>(null);
  const [fundError, setFundError] = useState('');
  const [blindfoldUrl, setBlindfoldUrl] = useState<string | null>(null);

  // Task submission state
  const [taskMemberId, setTaskMemberId] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [taskBudget, setTaskBudget] = useState('');
  const [taskSubmitting, setTaskSubmitting] = useState(false);
  const [taskResult, setTaskResult] = useState<TaskResult | null>(null);
  const [taskError, setTaskError] = useState('');

  // Delete confirmation
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [authError, setAuthError] = useState<string | null>(null);

  // Authenticate wallet before making API calls
  const authenticate = useCallback(async (): Promise<boolean> => {
    if (!publicKey || !wallet.signMessage) {
      return false;
    }

    try {
      const authed = await ensureAuthenticated(() => ({
        publicKey: publicKey.toBase58(),
        signMessage: wallet.signMessage!,
      }));
      if (!authed) {
        setAuthError('Authentication failed');
      }
      return authed;
    } catch (err) {
      console.error('Authentication failed:', err);
      const msg = err instanceof Error ? err.message : 'Unknown error';
      if (msg.includes('User rejected')) {
        setAuthError('Please sign the message to view team details');
      } else {
        setAuthError(`Authentication failed: ${msg}`);
      }
      return false;
    }
  }, [publicKey, wallet.signMessage]);

  const fetchTeam = useCallback(async () => {
    try {
      const data = await getTeam(teamId);
      setTeam(data);
      setDraws(data.recentDraws);
      setAuthError(null);
    } catch (err) {
      console.error('Failed to fetch team:', err);
      const msg = err instanceof Error ? err.message : 'Failed to load team';
      if (msg.includes('401') || msg.includes('Authentication')) {
        setAuthError('Please connect your wallet to view team details');
      }
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  const fetchDraws = useCallback(async () => {
    try {
      const data = await getDraws(teamId, { limit: 20 });
      setDraws(data.draws);
      setDrawsTotal(data.total);
    } catch (err) {
      console.error('Failed to fetch draws:', err);
    }
  }, [teamId]);

  // Authenticate and fetch when wallet connects
  useEffect(() => {
    const init = async () => {
      if (publicKey && wallet.signMessage) {
        const authed = await authenticate();
        if (authed) {
          fetchTeam();
        }
      } else {
        // No wallet - still try to fetch (will fail with 401 but shows loading state)
        setAuthError('Connect your wallet to view team details');
        setLoading(false);
      }
    };
    init();
  }, [publicKey, wallet.signMessage, authenticate, fetchTeam]);

  // Poll for draw status updates every 10s
  useEffect(() => {
    const hasPending = draws.some((d) => d.blindfoldStatus === 'pending' || d.blindfoldStatus === 'processing');
    if (!hasPending) return;

    const interval = setInterval(fetchDraws, 10000);
    return () => clearInterval(interval);
  }, [draws, fetchDraws]);

  const handleFund = async () => {
    const amount = parseFloat(fundAmount);
    if (!amount || amount <= 0) return;
    setFundError('');
    try {
      if (fundMode === 'credits') {
        // Fund with actual $KAMIYO tokens
        if (!publicKey || !signTransaction) {
          setFundError('Connect wallet first');
          return;
        }

        // Get user's token account
        // pump.fun tokens use Token-2022, try that first
        let userAta: PublicKey;
        let tokenProgram = TOKEN_2022_PROGRAM_ID;

        try {
          userAta = await getAssociatedTokenAddress(KAMIYO_MINT, publicKey, false, TOKEN_2022_PROGRAM_ID);
          await getAccount(connection, userAta, 'confirmed', TOKEN_2022_PROGRAM_ID);
        } catch {
          // Fall back to standard token program
          try {
            userAta = await getAssociatedTokenAddress(KAMIYO_MINT, publicKey, false, TOKEN_PROGRAM_ID);
            await getAccount(connection, userAta, 'confirmed', TOKEN_PROGRAM_ID);
            tokenProgram = TOKEN_PROGRAM_ID;
          } catch {
            setFundError('No $KAMIYO tokens found in wallet');
            return;
          }
        }

        // Get treasury's token account (create if needed)
        const treasuryAta = await getAssociatedTokenAddress(KAMIYO_MINT, HIVE_TREASURY, false, tokenProgram);
        const tx = new Transaction();

        // Check if treasury ATA exists, create if not
        try {
          await getAccount(connection, treasuryAta, 'confirmed', tokenProgram);
        } catch {
          // Treasury ATA doesn't exist, add create instruction (user pays)
          tx.add(createAssociatedTokenAccountInstruction(
            publicKey,
            treasuryAta,
            HIVE_TREASURY,
            KAMIYO_MINT,
            tokenProgram
          ));
        }

        // Build transfer instruction
        const tokenAmount = BigInt(Math.floor(amount * Math.pow(10, KAMIYO_DECIMALS)));
        const transferIx = createTransferCheckedInstruction(
          userAta,
          KAMIYO_MINT,
          treasuryAta,
          publicKey,
          tokenAmount,
          KAMIYO_DECIMALS,
          [],
          tokenProgram
        );

        // Add transfer to transaction and sign
        tx.add(transferIx);
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
        tx.recentBlockhash = blockhash;
        tx.lastValidBlockHeight = lastValidBlockHeight;
        tx.feePayer = publicKey;

        const signedTx = await signTransaction(tx);
        const serialized = signedTx.serialize().toString('base64');

        // Send to backend for submission and pool balance update
        const result = await fundWithTokens(teamId, serialized);
        setTeam((prev) => prev ? { ...prev, poolBalance: result.poolBalance } : prev);
        setFundAmount('');
      } else {
        const deposit = await initiateFunding(teamId, amount);
        if (deposit.status === 'confirmed') {
          setFundAmount('');
          fetchTeam();
        } else {
          setFundingDeposit(deposit);
        }
      }
    } catch (err) {
      setFundError(err instanceof Error ? err.message : 'Funding failed');
    }
  };

  // Poll deposit confirmation
  useEffect(() => {
    if (!fundingDeposit || fundingDeposit.status === 'confirmed') return;
    const interval = setInterval(async () => {
      try {
        const result = await confirmFunding(teamId, fundingDeposit.depositId);
        if (result.status === 'confirmed' && result.poolBalance !== undefined) {
          const balance = result.poolBalance;
          setTeam((prev) => prev ? { ...prev, poolBalance: balance } : prev);
          setFundingDeposit(null);
          setFundAmount('');
        } else if (result.status === 'expired') {
          setFundingDeposit(null);
          setFundError('Payment expired');
        }
      } catch {
        // continue polling
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [fundingDeposit, teamId]);

  const handleSubmitTask = async () => {
    if (!taskMemberId || !taskDescription) return;
    setTaskSubmitting(true);
    setTaskError('');
    setTaskResult(null);
    try {
      const result = await submitTask(teamId, {
        memberId: taskMemberId,
        description: taskDescription,
        budget: taskBudget ? parseFloat(taskBudget) : undefined,
      });
      setTaskResult(result);
      setTaskDescription('');
      setTaskBudget('');
      fetchDraws();
    } catch (err) {
      setTaskError(err instanceof Error ? err.message : 'Task submission failed');
    } finally {
      setTaskSubmitting(false);
    }
  };

  const handleAddMember = async () => {
    if (!newAgentId) return;
    try {
      await addMember(teamId, {
        agentId: newAgentId,
        role: newRole,
        drawLimit: newDrawLimit ? parseFloat(newDrawLimit) : 0,
      });
      setNewAgentId('');
      setNewDrawLimit('');
      fetchTeam();
    } catch (err) {
      console.error('Failed to add member:', err);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    try {
      await removeMember(teamId, memberId);
      fetchTeam();
    } catch (err) {
      console.error('Failed to remove member:', err);
    }
  };

  const handleUpdateMemberLimit = async (memberId: string) => {
    const limit = parseFloat(editLimitValue);
    if (isNaN(limit)) return;
    try {
      await updateBudget(teamId, { memberLimits: { [memberId]: limit } });
      setEditingLimit(null);
      fetchTeam();
    } catch (err) {
      console.error('Failed to update limit:', err);
    }
  };

  const handleUpdateDailyLimit = async () => {
    const limit = parseFloat(dailyLimitValue);
    if (isNaN(limit)) return;
    try {
      await updateBudget(teamId, { dailyLimit: limit });
      setEditingDailyLimit(false);
      fetchTeam();
    } catch (err) {
      console.error('Failed to update daily limit:', err);
    }
  };

  if (loading) {
    return <div className="min-h-screen pt-24 md:pt-28 pb-16 px-5 max-w-[1400px] mx-auto text-gray-500 text-sm">Loading...</div>;
  }

  if (authError && !team) {
    return (
      <div className="min-h-screen pt-24 md:pt-28 pb-16 px-5 max-w-[1400px] mx-auto">
        <div className="text-center py-12">
          <p className="text-gray-400 mb-4">{authError}</p>
          <p className="text-gray-600 text-sm">Connect your Solana wallet to access Hive</p>
        </div>
      </div>
    );
  }

  if (!team) {
    return <div className="min-h-screen pt-24 md:pt-28 pb-16 px-5 max-w-[1400px] mx-auto text-gray-500 text-sm">Team not found.</div>;
  }

  const spendPct = team.dailyLimit > 0 ? Math.min(100, (team.dailySpend / team.dailyLimit) * 100) : 0;

  return (
    <div className="min-h-screen pt-24 md:pt-28 pb-16 px-5 max-w-[1400px] mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold text-white">{team.name}</h1>
          <button
            onClick={() => setShowDeleteModal(true)}
            className="text-gray-600 hover:text-red-400 text-xs transition-colors"
          >
            Delete hive
          </button>
        </div>

        <div className="space-y-6">

      {/* Budget + Draw History - Two Column Row */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Budget Section */}
        <div className="card relative p-6 rounded-lg border border-gray-500/25 bg-black/20">
          <h2 className="text-sm uppercase tracking-wider text-gray-400 mb-4">Budget</h2>
          <div className="space-y-4">
            <div>
              <div className="text-3xl font-bold bg-gradient-to-r from-[#00f0ff] to-[#ff44f5] bg-clip-text text-transparent mb-1">
                {team.poolBalance.toFixed(2)} {team.currency}
              </div>
              <span className="text-gray-500 text-xs">Pool balance</span>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-2">
                {editingDailyLimit ? (
                  <div className="flex items-center gap-2">
                    <input
                      value={dailyLimitValue}
                      onChange={(e) => setDailyLimitValue(e.target.value)}
                      type="number"
                      className="w-24 bg-black border border-[#00f0ff] rounded px-2 py-1 text-white text-sm focus:outline-none"
                      onKeyDown={(e) => e.key === 'Enter' && handleUpdateDailyLimit()}
                      autoFocus
                    />
                    <button onClick={handleUpdateDailyLimit} className="text-[#00f0ff] text-xs">Save</button>
                    <button onClick={() => setEditingDailyLimit(false)} className="text-gray-500 text-xs">Cancel</button>
                  </div>
                ) : (
                  <span
                    className="text-white cursor-pointer hover:text-[#00f0ff] transition-colors"
                    onClick={() => { setEditingDailyLimit(true); setDailyLimitValue(String(team.dailyLimit)); }}
                  >
                    {team.dailyLimit.toFixed(2)} {team.currency}/day
                  </span>
                )}
              </div>
              <div className="w-full bg-gray-800 rounded-full h-2 mb-1">
                <div className="h-2 rounded-full bg-[#00f0ff] transition-all" style={{ width: `${spendPct}%` }} />
              </div>
              <span className="text-gray-500 text-xs">{team.dailySpend.toFixed(2)} spent today</span>
            </div>
          </div>
        </div>

        {/* Draw History */}
        <div className="card relative p-6 rounded-lg border border-gray-500/25 bg-black/20">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm uppercase tracking-wider text-gray-400">Draw History</h2>
            <span className="text-gray-600 text-xs">{drawsTotal} total</span>
          </div>
          {draws.length === 0 ? (
            <div className="text-gray-600 text-sm">No draws yet.</div>
          ) : (
            <div className="space-y-2">
              {draws.map((d) => (
                <div key={d.id} className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0">
                  <div>
                    <span className="text-white text-sm font-mono">{d.agentId}</span>
                    {d.purpose && <span className="text-gray-500 text-xs ml-2">{d.purpose}</span>}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-gray-300 text-sm">{d.amount.toFixed(2)} {team.currency}</span>
                    <StatusBadge status={d.blindfoldStatus} />
                    <span className="text-gray-600 text-xs">
                      {new Date(d.createdAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Members Section */}
      <div className="card relative p-6 rounded-lg border border-gray-500/25 bg-black/20">
        <h2 className="text-sm uppercase tracking-wider text-gray-400 mb-4">Members</h2>
        <div className="space-y-2 mb-4">
          {team.members.map((m) => (
            <div key={m.id} className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0">
              <div className="flex items-center gap-3">
                <span className="text-white text-sm font-mono">{m.agentId}</span>
                <span className={`text-xs px-2 py-0.5 rounded ${m.role === 'admin' ? 'bg-[#ff44f5]/10 text-[#ff44f5]' : 'bg-gray-800 text-gray-400'}`}>
                  {m.role}
                </span>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  {editingLimit === m.id ? (
                    <div className="flex items-center gap-1">
                      <input
                        value={editLimitValue}
                        onChange={(e) => setEditLimitValue(e.target.value)}
                        type="number"
                        className="w-20 bg-black border border-[#00f0ff] rounded px-2 py-1 text-white text-xs focus:outline-none"
                        onKeyDown={(e) => e.key === 'Enter' && handleUpdateMemberLimit(m.id)}
                        autoFocus
                      />
                      <button onClick={() => handleUpdateMemberLimit(m.id)} className="text-[#00f0ff] text-xs">OK</button>
                    </div>
                  ) : (
                    <span
                      className="text-gray-300 text-sm cursor-pointer hover:text-[#00f0ff]"
                      onClick={() => { setEditingLimit(m.id); setEditLimitValue(String(m.drawLimit)); }}
                    >
                      {m.drawLimit.toFixed(2)} limit
                    </span>
                  )}
                  <div className="text-gray-500 text-xs">{m.drawnToday.toFixed(2)} drawn</div>
                </div>
                <button
                  onClick={() => handleRemoveMember(m.id)}
                  className="text-gray-600 hover:text-red-400 text-xs transition-colors"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>

        <div>
          <div className="flex gap-2">
            <input
              value={newAgentId}
              onChange={(e) => setNewAgentId(e.target.value)}
              className="flex-1 bg-black/20 border border-gray-500/50 rounded px-3 py-2 text-white text-sm focus:border-gray-300 focus:outline-none"
              placeholder="Agent ID"
            />
            <select
              value={newRole}
              onChange={(e) => setNewRole(e.target.value)}
              className="bg-black/20 border border-gray-500/50 rounded px-3 py-2 text-white text-sm focus:border-gray-300 focus:outline-none appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2214%22%20height%3D%2214%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%239ca3af%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22M6%209l6%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[right_12px_center] pr-10"
            >
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
            <input
              value={newDrawLimit}
              onChange={(e) => setNewDrawLimit(e.target.value)}
              type="number"
              className="w-24 bg-black/20 border border-gray-500/50 rounded px-3 py-2 text-white text-sm focus:border-gray-300 focus:outline-none"
              placeholder="Limit"
            />
          </div>
          <div className="ml-8 mt-5">
            <PayButton
              text="Add"
              onClick={handleAddMember}
              disabled={!newAgentId}
            />
          </div>
        </div>
      </div>

      {/* Fund Section */}
      <div className="relative rounded-lg bg-black/20 border border-gray-500/25 overflow-visible">
        <div className="flex relative">
          <div
            onClick={() => { setFundMode('credits'); setBlindfoldUrl(null); }}
            className={`flex-1 px-4 py-3 text-xs uppercase tracking-wider transition-colors flex items-center justify-center gap-2 cursor-pointer relative z-10 ${fundMode === 'credits' ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}
          >
            {fundMode === 'credits' && (
              <div className="absolute inset-0 rounded-t-lg p-[1px] -z-10" style={{ background: 'linear-gradient(90deg, #00f0ff, #ff44f5)' }}>
                <div className="w-full h-full rounded-t-lg bg-black" style={{ borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }} />
              </div>
            )}
            <img src="/favicon.png" alt="" className="h-[25px] w-auto" />
            Fund with $KAMIYO
          </div>
          <div
            onClick={async () => {
              setFundMode('blindfold');
              setFundError('');
              try {
                const { fundingUrl } = await getBlindfoldFundingUrl(teamId);
                setBlindfoldUrl(fundingUrl);
              } catch (err) {
                setFundError(err instanceof Error ? err.message : 'Failed to load Blindfold');
              }
            }}
            className={`flex-1 px-4 py-3 text-xs uppercase tracking-wider transition-colors flex items-center justify-center gap-2 cursor-pointer relative z-10 ${fundMode === 'blindfold' ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}
          >
            {fundMode === 'blindfold' && (
              <div className="absolute inset-0 rounded-t-lg p-[1px] -z-10" style={{ background: 'linear-gradient(90deg, #00f0ff, #ff44f5)' }}>
                <div className="w-full h-full rounded-t-lg bg-black" style={{ borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }} />
              </div>
            )}
            <img src="/media/blindfold-logo.jpg" alt="" className="h-[60px] w-auto" />
            Blindfold Card
          </div>
        </div>
        <div className="border-t border-gray-500/25"></div>
        <div className="p-6">
        {fundMode === 'blindfold' ? (
          blindfoldUrl ? (
            <div className="space-y-3">
              <iframe
                src={blindfoldUrl}
                className="w-full h-[500px] rounded-lg border border-gray-700"
                allow="payment"
              />
              <button
                onClick={() => { setBlindfoldUrl(null); setFundMode('credits'); }}
                className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="text-center py-8">
              {fundError ? (
                <div className="text-red-400 text-sm">{fundError}</div>
              ) : (
                <div className="text-gray-400 text-sm animate-pulse">Loading Blindfold...</div>
              )}
            </div>
          )
        ) : fundingDeposit ? (
          <div className="space-y-3">
            <div className="text-sm text-gray-300">Send exactly:</div>
            <div className="text-lg font-mono text-white">{fundingDeposit.cryptoAmount} {team.currency}</div>
            <div className="text-sm text-gray-400">To address:</div>
            <div className="text-xs font-mono text-[#00f0ff] bg-gray-900 rounded p-2 break-all">{fundingDeposit.cryptoAddress}</div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">
                {fundingDeposit.expiresAt ? `Expires: ${new Date(fundingDeposit.expiresAt).toLocaleTimeString()}` : ''}
              </span>
              <span className="text-xs text-yellow-400 animate-pulse">Waiting for payment...</span>
            </div>
            <button
              onClick={() => setFundingDeposit(null)}
              className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
            >
              Cancel
            </button>
          </div>
        ) : (
          <>
            <input
              value={fundAmount}
              onChange={(e) => setFundAmount(e.target.value)}
              type="number"
              className="w-full bg-black/20 border border-gray-500/50 rounded px-4 py-3 text-white text-sm focus:border-gray-300 focus:outline-none"
              placeholder="Amount ($KAMIYO)"
            />
            <div className="flex items-center gap-2 mt-2">
              {[100, 500, 1000, 5000].map((amt) => (
                <button
                  key={amt}
                  onClick={() => setFundAmount(String(amt))}
                  className="text-xs text-gray-500 border border-gray-700 rounded px-2 py-1 hover:border-gray-500 hover:text-gray-300 transition-colors cursor-pointer"
                >
                  {amt.toLocaleString()}
                </button>
              ))}
            </div>
            <div className="ml-8 mt-5">
              <PayButton
                text="Fund with $KAMIYO"
                onClick={handleFund}
                disabled={!fundAmount || parseFloat(fundAmount) <= 0 || !publicKey}
              />
            </div>
            {fundError && <div className="text-red-400 text-xs mt-2">{fundError}</div>}
          </>
        )}
        </div>
      </div>

      {/* Submit Task */}
      <div className="card relative p-6 rounded-lg border border-gray-500/25 bg-black/20">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm uppercase tracking-wider text-gray-400">Submit Task</h2>
          {EXAMPLE_TASKS[team.name] && (
            <div className="flex gap-2 flex-wrap justify-end">
              {EXAMPLE_TASKS[team.name].map((example, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    const member = team.members.find(m => m.agentId === example.agent);
                    if (member) setTaskMemberId(member.id);
                    setTaskDescription(example.task);
                  }}
                  className="px-2 py-1 text-xs border border-gray-600/50 rounded hover:border-gray-500 text-gray-500 hover:text-gray-300 transition-colors"
                >
                  {example.agent}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="space-y-3">
          <div className="flex gap-2">
            <select
              value={taskMemberId}
              onChange={(e) => setTaskMemberId(e.target.value)}
              className="bg-black/20 border border-gray-500/50 rounded px-3 py-2 text-white text-sm focus:border-gray-300 focus:outline-none appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2214%22%20height%3D%2214%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%239ca3af%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22M6%209l6%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[right_12px_center] pr-10"
            >
              <option value="">Select agent</option>
              {team.members.map((m) => (
                <option key={m.id} value={m.id}>{m.agentId}</option>
              ))}
            </select>
            <input
              value={taskBudget}
              onChange={(e) => setTaskBudget(e.target.value)}
              type="number"
              className="w-28 bg-black/20 border border-gray-500/50 rounded px-3 py-2 text-white text-sm focus:border-gray-300 focus:outline-none"
              placeholder="Budget"
            />
          </div>
          <textarea
            value={taskDescription}
            onChange={(e) => setTaskDescription(e.target.value)}
            className="w-full bg-black/20 border border-gray-500/50 rounded px-4 py-3 text-white text-sm focus:border-gray-300 focus:outline-none resize-none h-24"
            placeholder="Describe the task (research, market analysis, wallet lookup...)"
          />
          <div className="flex items-center justify-between">
            <div className="ml-8">
              <PayButton
                text={taskSubmitting ? 'Running...' : 'Execute'}
                onClick={handleSubmitTask}
                disabled={!taskMemberId || !taskDescription || taskSubmitting}
              />
            </div>
            {taskError && <span className="text-red-400 text-xs">{taskError}</span>}
          </div>
          {taskResult && (
            <div className="mt-3 border border-gray-800 rounded p-3">
              <div className="flex items-center justify-between mb-2">
                <StatusBadge status={taskResult.status} />
                {taskResult.amountDrawn !== undefined && (
                  <span className="text-gray-400 text-xs">{taskResult.amountDrawn.toFixed(4)} {team.currency} drawn</span>
                )}
              </div>
              {taskResult.output && (
                <pre className="text-gray-300 text-xs whitespace-pre-wrap max-h-48 overflow-y-auto">{taskResult.output.result}</pre>
              )}
              {taskResult.error && (
                <div className="text-red-400 text-xs">{taskResult.error}</div>
              )}
            </div>
          )}
        </div>
      </div>

      </div>
      {/* End main content */}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="bg-black border border-gray-500/25 rounded-lg p-8 max-w-md w-full mx-4">
            <h3 className="text-xl text-white mb-2">Delete Team</h3>
            <p className="text-gray-400 mb-6">Are you sure you want to delete "{team.name}"? This cannot be undone.</p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  setDeleting(true);
                  try {
                    await deleteTeam(teamId);
                    router.push('/hive');
                  } catch (err) {
                    console.error('Failed to delete team:', err);
                    setDeleting(false);
                  }
                }}
                disabled={deleting}
                className="px-4 py-2 text-sm bg-red-500/10 text-red-400 border border-red-500/30 rounded hover:bg-red-500/20 transition-colors disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
