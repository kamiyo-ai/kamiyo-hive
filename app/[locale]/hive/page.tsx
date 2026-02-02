'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import PayButton from '@/components/PayButton';
import { createTeam, ensureAuthenticated } from '@/lib/hive-api';
import { Dropdown } from '@/components/ui/Dropdown';
import Link from 'next/link';

const HiveScene = dynamic(() => import('@/components/hive/HiveScene').then(m => m.HiveScene), {
  ssr: false,
});

const PRESETS = [
  {
    name: 'Trading Desk',
    currency: 'KAMIYO',
    dailyLimit: '1500',
    members: [
      { agentId: 'arb-agent', role: 'member', drawLimit: '500' },
      { agentId: 'market-maker', role: 'member', drawLimit: '500' },
      { agentId: 'trend-follower', role: 'member', drawLimit: '500' },
    ],
    exampleTasks: [
      { agent: 'arb-agent', task: 'Monitor SOL/USDC spread across Jupiter, Raydium, and Orca. Execute arbitrage when spread exceeds 0.3%' },
      { agent: 'market-maker', task: 'Place limit orders at 0.5% spread on SOL/USDC pair. Rebalance inventory when position exceeds 60% one side' },
      { agent: 'trend-follower', task: 'Analyze 4h candles for SOL. Enter long if price breaks above 20-day MA with volume confirmation' },
    ],
  },
  {
    name: 'Content Studio',
    currency: 'KAMIYO',
    dailyLimit: '100',
    members: [
      { agentId: 'writer', role: 'member', drawLimit: '40' },
      { agentId: 'editor', role: 'member', drawLimit: '30' },
      { agentId: 'publisher', role: 'admin', drawLimit: '30' },
    ],
    exampleTasks: [
      { agent: 'writer', task: 'Write a 800-word blog post about the latest Solana DeFi trends. Include 3 project spotlights with on-chain data' },
      { agent: 'editor', task: 'Review and fact-check the draft blog post. Verify all statistics and add relevant links to sources' },
      { agent: 'publisher', task: 'Format post for Medium and Twitter thread. Schedule publication for 9am EST and create promotional graphics' },
    ],
  },
  {
    name: 'Research Cluster',
    currency: 'KAMIYO',
    dailyLimit: '200',
    members: [
      { agentId: 'scraper', role: 'member', drawLimit: '80' },
      { agentId: 'analyst', role: 'member', drawLimit: '80' },
      { agentId: 'reporter', role: 'admin', drawLimit: '40' },
    ],
    exampleTasks: [
      { agent: 'scraper', task: 'Collect all token launches on pump.fun in the last 24h. Extract creator wallets, initial liquidity, and holder distribution' },
      { agent: 'analyst', task: 'Score the top 20 new tokens by whale concentration, dev wallet activity, and social sentiment. Flag any rug pull indicators' },
      { agent: 'reporter', task: 'Compile findings into a daily alpha report. Highlight top 3 opportunities and top 3 warnings with supporting evidence' },
    ],
  },
  {
    name: 'DevOps Hive',
    currency: 'KAMIYO',
    dailyLimit: '500',
    members: [
      { agentId: 'monitor', role: 'member', drawLimit: '100' },
      { agentId: 'fixer', role: 'member', drawLimit: '300' },
      { agentId: 'deployer', role: 'admin', drawLimit: '100' },
    ],
    exampleTasks: [
      { agent: 'monitor', task: 'Check RPC endpoint latency and error rates. Alert if p95 latency exceeds 500ms or error rate exceeds 1%' },
      { agent: 'fixer', task: 'Investigate the failed transaction batch from 14:00 UTC. Retry with higher priority fee if network congestion was the cause' },
      { agent: 'deployer', task: 'Deploy the updated price oracle to devnet. Run integration tests and prepare mainnet deployment PR for review' },
    ],
  },
];

export default function HivePage() {
  const router = useRouter();
  const wallet = useWallet();
  const { setVisible } = useWalletModal();
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pendingCreate = useRef(false);

  // Create form state
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState('KAMIYO');
  const [dailyLimit, setDailyLimit] = useState('');
  const [members, setMembers] = useState([{ agentId: '', role: 'member', drawLimit: '' }]);
  const memberInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const applyPreset = (preset: typeof PRESETS[0]) => {
    setName(preset.name);
    setCurrency(preset.currency);
    setDailyLimit(preset.dailyLimit);
    setMembers(preset.members);
  };

  // When wallet connects after user clicked create, proceed with creation
  useEffect(() => {
    if (wallet.publicKey && pendingCreate.current) {
      pendingCreate.current = false;
      doCreate();
    }
  }, [wallet.publicKey]);

  const authenticate = async (): Promise<boolean> => {
    if (!wallet.publicKey || !wallet.signMessage) {
      return false;
    }

    try {
      const authed = await ensureAuthenticated(() => ({
        publicKey: wallet.publicKey!.toBase58(),
        signMessage: wallet.signMessage!,
      }));
      if (!authed) {
        setError('Failed to authenticate wallet');
      }
      return authed;
    } catch (err) {
      console.error('Authentication failed:', err);
      const msg = err instanceof Error ? err.message : 'Unknown error';
      if (msg.includes('User rejected')) {
        setError('Signature request rejected');
      } else if (msg.includes('expired')) {
        setError('Challenge expired, please try again');
      } else {
        setError(`Authentication failed: ${msg}`);
      }
      return false;
    }
  };

  const doCreate = async () => {
    if (!name || !dailyLimit || !wallet.publicKey) return;
    setCreating(true);
    setError(null);

    try {
      const authenticated = await authenticate();
      if (!authenticated) {
        setError('Failed to authenticate wallet');
        setCreating(false);
        return;
      }

      const team = await createTeam({
        name,
        currency,
        dailyLimit: parseFloat(dailyLimit),
        members: members
          .filter((m) => m.agentId)
          .map((m) => ({
            agentId: m.agentId,
            role: m.role,
            drawLimit: m.drawLimit ? parseFloat(m.drawLimit) : 0,
          })),
      });
      router.push(`/hive/${team.id}`);
    } catch (err) {
      console.error('Failed to create team:', err);
      const message = err instanceof Error
        ? err.message
        : typeof err === 'string'
          ? err
          : 'Failed to create team';
      setError(message);
      setCreating(false);
    }
  };

  const handleCreate = async () => {
    setError(null);

    if (!wallet.publicKey) {
      pendingCreate.current = true;
      setVisible(true);
      return;
    }

    doCreate();
  };

  const addMemberRow = (focusNew = false) => {
    setMembers(prev => {
      const newMembers = [...prev, { agentId: '', role: 'member', drawLimit: '' }];
      if (focusNew) {
        setTimeout(() => memberInputRefs.current[newMembers.length - 1]?.focus(), 0);
      }
      return newMembers;
    });
  };

  const handleMemberKeyDown = (e: React.KeyboardEvent, idx: number) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (idx === members.length - 1) {
        addMemberRow(true);
      } else {
        memberInputRefs.current[idx + 1]?.focus();
      }
    }
  };

  const updateMember = (idx: number, field: string, value: string) => {
    const updated = [...members];
    updated[idx] = { ...updated[idx], [field]: value };
    setMembers(updated);
  };

  // Live update scene with members as they're added
  const sceneMembers = members
    .filter((m) => m.agentId)
    .map((m, i) => ({
      id: `new-${i}`,
      agentId: m.agentId,
      role: m.role,
    }));

  return (
    <div className="relative min-h-screen w-full overflow-hidden">
      {/* 3D Scene Background */}
      <HiveScene members={sceneMembers} />

      <div className="absolute inset-0 pointer-events-none overflow-y-auto flex items-start md:items-center pt-20 md:pt-0">
        <div className="w-full px-3 sm:px-5 mx-auto py-4 sm:py-8" style={{ maxWidth: '1400px' }}>
          {/* Page Header */}
          <div className="mb-4 sm:mb-8 pointer-events-auto">
            <p className="font-light text-xs sm:text-sm uppercase tracking-widest gradient-text mb-2 sm:mb-4">
              — Hive ハイブ
            </p>
            <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl text-white mb-2 sm:mb-3">Agent Treasury Management</h1>
            <p className="text-gray-400 text-xs sm:text-sm max-w-2xl">
              Create shared treasuries for AI agent teams with configurable spending limits and role-based access control.
              Agents build reputation through completed tasks&mdash;explore the{' '}
              <Link href="/trust-graph" className="text-cyan hover:underline">
                Trust Graph
              </Link>{' '}
              to see how agent reputation works.
            </p>
          </div>

          <div className="flex flex-col lg:flex-row gap-4 sm:gap-6 items-start">
            <div className="card relative p-4 sm:p-6 rounded-lg border border-gray-500/25 bg-black/50 pointer-events-auto flex-1 w-full">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-0 mb-4">
              <h2 className="text-xs sm:text-sm uppercase tracking-wider text-gray-400">New Hive</h2>
              <div className="flex flex-wrap gap-1 sm:gap-2">
                {PRESETS.map((preset) => (
                  <button
                    key={preset.name}
                    onClick={() => applyPreset(preset)}
                    className="px-1.5 sm:px-2 py-1 text-[10px] sm:text-xs border border-gray-600/50 rounded hover:border-gray-500 text-gray-500 hover:text-gray-300 transition-colors"
                  >
                    {preset.name}
                  </button>
                ))}
              </div>
            </div>
          {error && (
            <div className="px-3 sm:px-4 py-2 sm:py-3 rounded mb-4 text-xs sm:text-sm" style={{ backgroundColor: 'rgba(255, 50, 50, 0.05)', border: '1px solid rgba(255, 50, 50, 0.5)', color: '#ff3232' }}>
              {error}
            </div>
          )}
          <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 mb-4">
            <div>
              <label className="text-gray-400 text-[10px] sm:text-xs uppercase tracking-wider mb-1 block">Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-black border border-gray-500/50 rounded px-3 sm:px-4 py-2 sm:py-3 text-white text-xs sm:text-sm focus:border-[#364153] focus:outline-none transition-colors"
                placeholder="Trading Squad"
              />
            </div>
            <div>
              <label className="text-gray-400 text-[10px] sm:text-xs uppercase tracking-wider mb-1 block">Daily Limit</label>
              <input
                value={dailyLimit}
                onChange={(e) => setDailyLimit(e.target.value)}
                type="number"
                className="w-full bg-black border border-gray-500/50 rounded px-3 sm:px-4 py-2 sm:py-3 text-white text-xs sm:text-sm focus:border-[#364153] focus:outline-none transition-colors"
                placeholder="10.0"
              />
            </div>
            <div className="relative z-[50] sm:col-span-2 md:col-span-1">
              <label className="text-gray-400 text-[10px] sm:text-xs uppercase tracking-wider mb-1 block">Currency</label>
              <Dropdown
                value={currency}
                onChange={setCurrency}
                options={[
                  { value: 'KAMIYO', label: '$KAMIYO' },
                  { value: 'SOL', label: 'SOL' },
                  { value: 'USDC', label: 'USDC' },
                ]}
              />
            </div>
          </div>

          <div className="mb-4 relative z-[40]">
            <label className="text-gray-400 text-[10px] sm:text-xs uppercase tracking-wider mb-2 block">Members</label>
            {members.map((m, idx) => (
              <div key={idx} className="flex gap-1 sm:gap-2 mb-2">
                {members.length > 1 && (
                  <button
                    onClick={() => setMembers(members.filter((_, i) => i !== idx))}
                    className="text-gray-600 hover:text-red-400 text-xs px-1 sm:px-2 transition-colors self-center"
                    title="Remove member"
                  >
                    x
                  </button>
                )}
                <div className="grid grid-cols-3 gap-2 sm:gap-4 flex-1">
                  <input
                    ref={el => { memberInputRefs.current[idx] = el; }}
                    value={m.agentId}
                    onChange={(e) => updateMember(idx, 'agentId', e.target.value)}
                    onKeyDown={(e) => handleMemberKeyDown(e, idx)}
                    className="bg-black border border-gray-500/50 rounded px-2 sm:px-4 py-2 sm:py-3 text-white text-xs sm:text-sm focus:border-[#364153] focus:outline-none"
                    placeholder="Agent ID"
                  />
                  <input
                    value={m.drawLimit}
                    onChange={(e) => updateMember(idx, 'drawLimit', e.target.value)}
                    onKeyDown={(e) => handleMemberKeyDown(e, idx)}
                    type="number"
                    className="bg-black border border-gray-500/50 rounded px-2 sm:px-4 py-2 sm:py-3 text-white text-xs sm:text-sm focus:border-[#364153] focus:outline-none"
                    placeholder="Limit"
                  />
                  <Dropdown
                    value={m.role}
                    onChange={(val) => updateMember(idx, 'role', val)}
                    options={[
                      { value: 'member', label: 'Member' },
                      { value: 'admin', label: 'Admin' },
                    ]}
                  />
                </div>
              </div>
            ))}
            <button
              onClick={() => addMemberRow(true)}
              className="text-gray-500 text-[10px] sm:text-xs hover:text-gray-300 transition-colors"
            >
              + Add member
            </button>
          </div>

          <div className="flex items-center justify-center">
            <PayButton
              text={creating ? 'Creating...' : !wallet.publicKey ? 'Connect Wallet' : 'Create Hive'}
              onClick={handleCreate}
              disabled={creating || !name || !dailyLimit}
            />
          </div>
          </div>
          </div>
        </div>
      </div>
    </div>
  );
}
