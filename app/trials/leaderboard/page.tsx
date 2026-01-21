'use client';

import { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import CtaButton from '@/components/CtaButton';
import CountdownTimer from '@/components/CountdownTimer';

interface LeaderboardEntry {
  wallet: string;
  score: number;
  entries: number;
  referralCount: number;
  completedAt: number;
}


export default function LeaderboardPage() {
  const { publicKey } = useWallet();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const response = await fetch('/api/trials/complete');
        if (response.ok) {
          const data = await response.json();
          setEntries(data.entries || []);
        }
      } catch {
        // API error - show empty state
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboard();
  }, []);

  const formatWallet = (wallet: string) => {
    if (wallet.includes('...')) return wallet;
    return `${wallet.slice(0, 4)}...${wallet.slice(-4)}`;
  };

  const formatTime = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    return 'Just now';
  };

  const totalEntries = entries.reduce((sum, e) => sum + e.entries, 0);
  const totalReferrals = entries.reduce((sum, e) => sum + e.referralCount, 0);

  const userEntry = publicKey
    ? entries.find((e) => e.wallet.startsWith(publicKey.toBase58().slice(0, 4)))
    : null;

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="w-full px-5 mx-auto max-w-[1400px] py-16">
        <div className="flex items-center justify-between mb-12">
          <div>
            <h1 className="text-3xl md:text-4xl text-white">Trials Leaderboard</h1>
          </div>
          <div style={{ transform: 'translateX(-32px)' }}>
            <CtaButton text="Enter the Trials" href="/trials" />
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
          <div className="bg-black border border-gray-500/25 rounded-lg p-5 text-center">
            <div className="gradient-text text-xs uppercase tracking-wider mb-2">Participants</div>
            <div className="text-white text-2xl font-light">{entries.length}</div>
          </div>
          <div className="bg-black border border-gray-500/25 rounded-lg p-5 text-center">
            <div className="gradient-text text-xs uppercase tracking-wider mb-2">Total Entries</div>
            <div className="text-white text-2xl font-light">{totalEntries}</div>
          </div>
          <div className="bg-black border border-gray-500/25 rounded-lg p-5 text-center">
            <div className="gradient-text text-xs uppercase tracking-wider mb-2">Referrals</div>
            <div className="text-white text-2xl font-light">{totalReferrals}</div>
          </div>
          <div className="bg-black border border-gray-500/25 rounded-lg p-5">
            <CountdownTimer />
          </div>
        </div>

        {/* User's Position */}
        {userEntry && (
          <div className="bg-black border border-gray-500/25 rounded-lg p-6 mb-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full flex items-center justify-center font-mono" style={{ backgroundColor: 'rgba(0, 240, 255, 0.2)', color: '#00f0ff' }}>
                  #{entries.findIndex((e) => e.wallet === userEntry.wallet) + 1}
                </div>
                <div>
                  <p className="text-white">Your Position</p>
                  <p className="text-gray-400 text-sm font-mono">{formatWallet(userEntry.wallet)}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl" style={{ color: '#00f0ff' }}>{userEntry.entries} entries</p>
                <p className="text-gray-500 text-sm">{userEntry.referralCount} referrals</p>
              </div>
            </div>
          </div>
        )}

        {/* Leaderboard Table */}
        <div className="border border-gray-500/25 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-900/50">
              <tr>
                <th className="text-left p-4 text-gray-400 font-light text-sm">Rank</th>
                <th className="text-left p-4 text-gray-400 font-light text-sm">Wallet</th>
                <th className="text-left p-4 text-gray-400 font-light text-sm">Entries</th>
                <th className="text-left p-4 text-gray-400 font-light text-sm hidden md:table-cell">Referrals</th>
                <th className="text-left p-4 text-gray-400 font-light text-sm hidden md:table-cell">Completed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {loading ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-gray-500">
                    Loading...
                  </td>
                </tr>
              ) : entries.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-gray-500">
                    No participants yet. Be the first!
                  </td>
                </tr>
              ) : (
                entries.map((entry, idx) => (
                  <tr
                    key={entry.wallet}
                    style={
                      publicKey && entry.wallet.startsWith(publicKey.toBase58().slice(0, 4))
                        ? { backgroundColor: 'rgba(0, 240, 255, 0.05)' }
                        : undefined
                    }
                  >
                    <td className="p-4">
                      <span
                        className={`font-mono ${
                          idx === 0
                            ? 'text-yellow-400'
                            : idx < 3
                            ? 'text-gray-300'
                            : 'text-gray-500'
                        }`}
                      >
                        #{idx + 1}
                      </span>
                    </td>
                    <td className="p-4 font-mono text-sm text-white">{formatWallet(entry.wallet)}</td>
                    <td className="p-4">
                      <span style={{ color: entry.entries > 1 ? '#00f0ff' : '#ffffff' }}>
                        {entry.entries}
                      </span>
                    </td>
                    <td className="p-4 text-gray-400 hidden md:table-cell">
                      {entry.referralCount > 0 ? (
                        <span style={{ color: '#ff44f5' }}>+{entry.referralCount}</span>
                      ) : (
                        <span className="text-gray-600">0</span>
                      )}
                    </td>
                    <td className="p-4 text-gray-500 text-sm hidden md:table-cell">
                      {formatTime(entry.completedAt)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Prize Breakdown */}
        <div className="mt-12 border-t border-gray-800 pt-12">
          <h2 className="text-xl text-white mb-6 text-center">Prize Distribution</h2>
          <div className="max-w-md mx-auto space-y-4">
            <div className="flex justify-between items-center p-4 border border-gray-500/25 rounded-lg">
              <div className="flex items-center gap-3">
                <span className="gradient-text text-lg">1st</span>
                <span className="text-white">Grand Prize</span>
              </div>
              <span style={{ color: '#00f0ff' }}>1,000,000 $KAMIYO</span>
            </div>
            <div className="flex justify-between items-center p-4 border border-gray-500/25 rounded-lg">
              <div className="flex items-center gap-3">
                <span className="gradient-text">2nd-11th</span>
                <span className="text-white">Runner-up (10x)</span>
              </div>
              <span className="text-white">400,000 $KAMIYO each</span>
            </div>
            <p className="text-gray-500 text-sm text-center pt-4">
              Winners drawn weighted by entries.
              <br />
              More referrals = better odds.
              <br />
              Must score 5/5 and share on X to qualify.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
