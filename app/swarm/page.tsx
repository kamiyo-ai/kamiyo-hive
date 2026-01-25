'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import PayButton from '@/components/PayButton';
import { createTeam } from '@/lib/swarm-api';

const SwarmScene = dynamic(() => import('@/components/swarm/SwarmScene').then(m => m.SwarmScene), {
  ssr: false,
});

export default function SwarmPage() {
  const router = useRouter();
  const [creating, setCreating] = useState(false);

  // Create form state
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState('SOL');
  const [dailyLimit, setDailyLimit] = useState('');
  const [members, setMembers] = useState([{ agentId: '', role: 'member', drawLimit: '' }]);

  const handleCreate = async () => {
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
          <h2 className="text-sm uppercase tracking-wider text-gray-400 mb-4">New SwarmTeam</h2>
          <div className="grid gap-4 grid-cols-1 md:grid-cols-3 mb-4">
            <div>
              <label className="text-gray-400 text-xs uppercase tracking-wider mb-1 block">Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-black border border-gray-500/50 rounded px-4 py-3 text-white text-sm focus:border-[#00f0ff] focus:outline-none transition-colors"
                placeholder="Trading Squad"
              />
            </div>
            <div>
              <label className="text-gray-400 text-xs uppercase tracking-wider mb-1 block">Currency</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full bg-black border border-gray-500/50 rounded px-4 py-3 text-white text-sm focus:border-[#00f0ff] focus:outline-none transition-colors"
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
                className="w-full bg-black border border-gray-500/50 rounded px-4 py-3 text-white text-sm focus:border-[#00f0ff] focus:outline-none transition-colors"
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
                  className="bg-black border border-gray-500/50 rounded px-3 py-2 text-white text-sm focus:border-[#00f0ff] focus:outline-none"
                  placeholder="Agent ID"
                />
                <select
                  value={m.role}
                  onChange={(e) => updateMember(idx, 'role', e.target.value)}
                  className="bg-black border border-gray-500/50 rounded px-3 py-2 text-white text-sm focus:border-[#00f0ff] focus:outline-none"
                >
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                </select>
                <input
                  value={m.drawLimit}
                  onChange={(e) => updateMember(idx, 'drawLimit', e.target.value)}
                  type="number"
                  className="bg-black border border-gray-500/50 rounded px-3 py-2 text-white text-sm focus:border-[#00f0ff] focus:outline-none"
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
              text={creating ? 'Creating...' : 'Create Swarm'}
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
