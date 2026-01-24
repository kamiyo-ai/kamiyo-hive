'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import PayButton from '@/components/PayButton';
import { listTeams, createTeam, SwarmTeam } from '@/lib/swarm-api';

export default function SwarmPage() {
  const [teams, setTeams] = useState<SwarmTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);

  // Create form state
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState('SOL');
  const [dailyLimit, setDailyLimit] = useState('');
  const [members, setMembers] = useState([{ agentId: '', role: 'member', drawLimit: '' }]);

  const fetchTeams = useCallback(async () => {
    try {
      const data = await listTeams();
      setTeams(data);
    } catch (err) {
      console.error('Failed to fetch teams:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTeams(); }, [fetchTeams]);

  const handleCreate = async () => {
    if (!name || !dailyLimit) return;
    setCreating(true);
    try {
      await createTeam({
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
      setName('');
      setDailyLimit('');
      setMembers([{ agentId: '', role: 'member', drawLimit: '' }]);
      setShowCreate(false);
      fetchTeams();
    } catch (err) {
      console.error('Failed to create team:', err);
    } finally {
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

  return (
    <div className="min-h-screen py-8 md:py-16 px-5 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between mb-10">
        <h1 className="text-2xl font-bold text-white">SwarmTeams</h1>
        <PayButton
          text={showCreate ? 'Cancel' : 'Create Team'}
          onClick={() => setShowCreate(!showCreate)}
        />
      </div>

      {showCreate && (
        <div className="card relative p-6 rounded-lg border border-gray-500/25 mb-8">
          <h2 className="text-sm uppercase tracking-wider text-gray-400 mb-4">New Team</h2>
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

          <PayButton
            text={creating ? 'Creating...' : 'Create'}
            onClick={handleCreate}
            disabled={creating || !name || !dailyLimit}
          />
        </div>
      )}

      {loading ? (
        <div className="text-gray-500 text-sm">Loading teams...</div>
      ) : teams.length === 0 ? (
        <div className="text-gray-500 text-sm">No teams yet. Create one to get started.</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {teams.map((team) => (
            <Link key={team.id} href={`/swarm/${team.id}`}>
              <div className="card relative p-6 rounded-lg border border-gray-500/25 hover:border-gray-400/50 transition-colors cursor-pointer">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-white font-medium">{team.name}</h3>
                  <span className="text-gray-500 text-xs">{team.memberCount} agents</span>
                </div>
                <div className="text-2xl font-bold bg-gradient-to-r from-[#00f0ff] to-[#ff44f5] bg-clip-text text-transparent mb-3">
                  {team.poolBalance.toFixed(2)} {team.currency}
                </div>
                <div className="w-full bg-gray-800 rounded-full h-1.5 mb-2">
                  <div
                    className="h-1.5 rounded-full bg-[#00f0ff]"
                    style={{ width: `${Math.min(100, (team.dailySpend / team.dailyLimit) * 100)}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-gray-500">
                  <span>{team.dailySpend.toFixed(2)} spent today</span>
                  <span>{team.dailyLimit.toFixed(2)} limit</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
