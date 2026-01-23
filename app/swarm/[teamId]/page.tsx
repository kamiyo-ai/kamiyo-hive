'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  getTeam, addMember, removeMember, fundTeam, updateBudget, getDraws,
  SwarmTeamDetail, SwarmDraw,
} from '@/lib/swarm-api';

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
  const teamId = params.teamId as string;

  const [team, setTeam] = useState<SwarmTeamDetail | null>(null);
  const [draws, setDraws] = useState<SwarmDraw[]>([]);
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

  const fetchTeam = useCallback(async () => {
    try {
      const data = await getTeam(teamId);
      setTeam(data);
      setDraws(data.recentDraws);
    } catch (err) {
      console.error('Failed to fetch team:', err);
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

  useEffect(() => { fetchTeam(); }, [fetchTeam]);

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
    try {
      const result = await fundTeam(teamId, amount);
      setTeam((prev) => prev ? { ...prev, poolBalance: result.poolBalance } : prev);
      setFundAmount('');
    } catch (err) {
      console.error('Failed to fund team:', err);
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
    return <div className="min-h-screen py-16 px-5 max-w-[1400px] mx-auto text-gray-500 text-sm">Loading...</div>;
  }

  if (!team) {
    return <div className="min-h-screen py-16 px-5 max-w-[1400px] mx-auto text-gray-500 text-sm">Team not found.</div>;
  }

  const spendPct = team.dailyLimit > 0 ? Math.min(100, (team.dailySpend / team.dailyLimit) * 100) : 0;

  return (
    <div className="min-h-screen py-16 px-5 max-w-[1400px] mx-auto">
      <Link href="/swarm" className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-300 mb-8 text-sm transition-colors">
        &larr; Back to teams
      </Link>

      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-white">{team.name}</h1>
        <span className="text-gray-500 text-sm">{team.currency}</span>
      </div>

      {/* Budget Section */}
      <div className="card relative p-6 rounded-xl border border-gray-500/25 mb-6">
        <h2 className="text-sm uppercase tracking-wider text-gray-400 mb-4">Budget</h2>
        <div className="grid md:grid-cols-2 gap-6">
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

      {/* Members Section */}
      <div className="card relative p-6 rounded-xl border border-gray-500/25 mb-6">
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

        <div className="flex gap-2">
          <input
            value={newAgentId}
            onChange={(e) => setNewAgentId(e.target.value)}
            className="flex-1 bg-black border border-gray-500/50 rounded px-3 py-2 text-white text-sm focus:border-[#00f0ff] focus:outline-none"
            placeholder="Agent ID"
          />
          <select
            value={newRole}
            onChange={(e) => setNewRole(e.target.value)}
            className="bg-black border border-gray-500/50 rounded px-3 py-2 text-white text-sm focus:border-[#00f0ff] focus:outline-none"
          >
            <option value="member">Member</option>
            <option value="admin">Admin</option>
          </select>
          <input
            value={newDrawLimit}
            onChange={(e) => setNewDrawLimit(e.target.value)}
            type="number"
            className="w-24 bg-black border border-gray-500/50 rounded px-3 py-2 text-white text-sm focus:border-[#00f0ff] focus:outline-none"
            placeholder="Limit"
          />
          <button
            onClick={handleAddMember}
            disabled={!newAgentId}
            className="border border-gray-500/50 text-gray-300 px-4 py-2 rounded text-sm hover:border-[#00f0ff] hover:text-[#00f0ff] transition-colors disabled:opacity-50"
          >
            Add
          </button>
        </div>
      </div>

      {/* Fund Section */}
      <div className="card relative p-6 rounded-xl border border-gray-500/25 mb-6">
        <h2 className="text-sm uppercase tracking-wider text-gray-400 mb-4">Fund Pool</h2>
        <div className="flex gap-2">
          <input
            value={fundAmount}
            onChange={(e) => setFundAmount(e.target.value)}
            type="number"
            className="flex-1 bg-black border border-gray-500/50 rounded px-4 py-3 text-white text-sm focus:border-[#00f0ff] focus:outline-none"
            placeholder={`Amount (${team.currency})`}
          />
          <button
            onClick={handleFund}
            disabled={!fundAmount || parseFloat(fundAmount) <= 0}
            className="bg-gradient-to-r from-[#00f0ff] to-[#ff44f5] text-black font-bold px-6 py-3 rounded text-sm disabled:opacity-50"
          >
            Fund
          </button>
        </div>
        <div className="flex gap-2 mt-2">
          {[1, 5, 10, 50].map((amt) => (
            <button
              key={amt}
              onClick={() => setFundAmount(String(amt))}
              className="text-xs text-gray-500 border border-gray-700 rounded px-2 py-1 hover:border-gray-500 hover:text-gray-300 transition-colors"
            >
              {amt} {team.currency}
            </button>
          ))}
        </div>
      </div>

      {/* Draw History */}
      <div className="card relative p-6 rounded-xl border border-gray-500/25">
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
  );
}
