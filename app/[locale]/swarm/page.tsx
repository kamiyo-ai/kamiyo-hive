'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import PayButton from '@/components/PayButton';
import { createTeam } from '@/lib/swarm-api';

const SwarmScene = dynamic(() => import('@/components/swarm/SwarmScene').then(m => m.SwarmScene), {
  ssr: false,
});

export default function SwarmPage() {
  const router = useRouter();
  const wallet = useWallet();
  const { setVisible } = useWalletModal();
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Create form state
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState('SOL');
  const [dailyLimit, setDailyLimit] = useState('');
  const [members, setMembers] = useState([{ agentId: '', role: 'member', drawLimit: '' }]);

  const handleCreate = async () => {
    setError(null);

    if (!wallet.publicKey) {
      setVisible(true);
      return;
    }

    if (!name || !dailyLimit) return;
    setCreating(true);
    try {
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
      router.push(`/swarm/${team.id}`);
    } catch (err) {
      console.error('Failed to create team:', err);
      setError(err instanceof Error ? err.message : 'Failed to create team');
      setCreating(false);
    }
  };

  const addMemberRow = () => {
    setMembers([...members, { agentId: '', role: 'member', drawLimit: '' }]);
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
    <div className="relative h-screen w-full overflow-hidden">
      {/* 3D Scene Background */}
      <SwarmScene members={sceneMembers} />

      {/* Create Form Overlay */}
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
        <div className="w-full px-5 mx-auto" style={{ maxWidth: '1400px' }}>
          <div className="card relative p-6 rounded-lg border border-gray-500/25 bg-black/20 pointer-events-auto">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-sm uppercase tracking-wider text-gray-400">New SwarmTeam</h2>
            {!wallet.publicKey && (
              <button
                onClick={() => setVisible(true)}
                className="text-xs text-[#00f0ff] hover:text-white transition-colors"
              >
                Connect Wallet
              </button>
            )}
          </div>
          {error && (
            <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-3 rounded mb-4 text-sm">
              {error}
            </div>
          )}
          <div className="grid gap-4 grid-cols-1 md:grid-cols-3 mb-4">
            <div>
              <label className="text-gray-400 text-xs uppercase tracking-wider mb-1 block">Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-black/20 border border-gray-500/50 rounded px-4 py-3 text-white text-sm focus:border-[#00f0ff] focus:outline-none transition-colors"
                placeholder="Trading Squad"
              />
            </div>
            <div>
              <label className="text-gray-400 text-xs uppercase tracking-wider mb-1 block">Currency</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full bg-black/20 border border-gray-500/50 rounded px-4 py-3 text-white text-sm focus:border-[#00f0ff] focus:outline-none transition-colors appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2214%22%20height%3D%2214%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%239ca3af%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22M6%209l6%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[right_12px_center]"
              >
                <option value="SOL">SOL</option>
                <option value="USDC">USDC</option>
              </select>
            </div>
            <div>
              <label className="text-gray-400 text-xs uppercase tracking-wider mb-1 block">Daily Limit</label>
              <input
                value={dailyLimit}
                onChange={(e) => setDailyLimit(e.target.value)}
                type="number"
                className="w-full bg-black/20 border border-gray-500/50 rounded px-4 py-3 text-white text-sm focus:border-[#00f0ff] focus:outline-none transition-colors"
                placeholder="10.0"
              />
            </div>
          </div>

          <div className="mb-4">
            <label className="text-gray-400 text-xs uppercase tracking-wider mb-2 block">Members</label>
            {members.map((m, idx) => (
              <div key={idx} className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-2">
                <input
                  value={m.agentId}
                  onChange={(e) => updateMember(idx, 'agentId', e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && m.agentId && addMemberRow()}
                  className="bg-black/20 border border-gray-500/50 rounded px-4 py-3 text-white text-sm focus:border-[#00f0ff] focus:outline-none"
                  placeholder="Agent ID"
                />
                <select
                  value={m.role}
                  onChange={(e) => updateMember(idx, 'role', e.target.value)}
                  className="bg-black/20 border border-gray-500/50 rounded px-4 py-3 text-white text-sm focus:border-[#00f0ff] focus:outline-none appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2214%22%20height%3D%2214%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%239ca3af%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22M6%209l6%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[right_12px_center]"
                >
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                </select>
                <input
                  value={m.drawLimit}
                  onChange={(e) => updateMember(idx, 'drawLimit', e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && m.agentId && addMemberRow()}
                  type="number"
                  className="bg-black/20 border border-gray-500/50 rounded px-4 py-3 text-white text-sm focus:border-[#00f0ff] focus:outline-none"
                  placeholder="Draw limit"
                />
              </div>
            ))}
            <button
              onClick={addMemberRow}
              className="text-gray-500 text-xs hover:text-gray-300 transition-colors"
            >
              + Add member
            </button>
          </div>

          <div className="flex justify-center">
            <PayButton
              text={creating ? 'Creating...' : !wallet.publicKey ? 'Connect Wallet to Create' : 'Create Swarm'}
              onClick={handleCreate}
              disabled={creating || !name || !dailyLimit}
            />
          </div>
          </div>
        </div>
      </div>
    </div>
  );
}
