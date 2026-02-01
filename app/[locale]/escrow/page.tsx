'use client';

import { useState } from 'react';
import PayButton from '@/components/PayButton';

const QUICK_AMOUNTS = [0.1, 0.5, 1, 5];
const TIMELOCK_OPTIONS = [
  { label: '1 hour', value: '1h' },
  { label: '24 hours', value: '24h' },
  { label: '7 days', value: '7d' },
  { label: '30 days', value: '30d' },
];

const API_BASE = 'https://kamiyo.ai';

export default function EscrowPage() {
  const [provider, setProvider] = useState('');
  const [amount, setAmount] = useState('');
  const [timelock, setTimelock] = useState('24h');
  const [reputationAddress, setReputationAddress] = useState('');
  const [reputationData, setReputationData] = useState<{
    title?: string;
    description?: string;
    label?: string;
    error?: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [escrowId, setEscrowId] = useState('');
  const [copied, setCopied] = useState(false);

  const generateEscrowUrl = () => {
    if (!provider) return '';
    let url = `${API_BASE}/api/actions/create-escrow?provider=${provider}`;
    if (amount) url += `&amount=${amount}`;
    if (timelock) url += `&timelock=${timelock}`;
    return url;
  };

  const checkReputation = async () => {
    if (!reputationAddress) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/actions/reputation?address=${reputationAddress}`);
      const data = await res.json();
      setReputationData(data);
    } catch {
      setReputationData({ error: 'Failed to fetch reputation' });
    }
    setLoading(false);
  };

  const copyEscrowUrl = () => {
    const url = generateEscrowUrl();
    if (url) {
      navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="w-full px-3 sm:px-5 mx-auto max-w-[1400px] pt-20 sm:pt-24 md:pt-28 pb-6 sm:pb-8 md:pb-16">
        <div className="mb-6 sm:mb-8 md:mb-16">
          <p className="font-light text-xs sm:text-sm uppercase tracking-widest gradient-text mb-2 sm:mb-4">
            — Escrow エスクロー
          </p>
          <h1 className="text-2xl sm:text-3xl md:text-4xl text-white mb-2 sm:mb-4">Escrow</h1>
          <p className="text-gray-400 text-xs sm:text-sm max-w-2xl">
            Create shareable escrow links for trustless payments.
            Lock SOL with timelock protection, release on delivery, or dispute for oracle arbitration.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-3 sm:gap-4 md:gap-8">
          {/* Create Escrow */}
          <div className="card relative p-4 sm:p-6 rounded-xl border border-gray-500/25">
            <h2 className="text-lg sm:text-xl text-white mb-4 sm:mb-6 pb-2 subheading-border">Create Escrow</h2>

            <div className="space-y-3 sm:space-y-4">
              <div>
                <label className="block text-gray-400 text-[10px] sm:text-xs uppercase tracking-wider mb-1 sm:mb-2">
                  Provider Address
                </label>
                <input
                  type="text"
                  value={provider}
                  onChange={(e) => setProvider(e.target.value)}
                  placeholder="Solana wallet address"
                  className="w-full bg-black border border-gray-500/50 rounded px-3 sm:px-4 py-2 sm:py-3 text-white text-xs sm:text-sm focus:border-[#364153] focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-gray-400 text-[10px] sm:text-xs uppercase tracking-wider mb-1 sm:mb-2">
                  Quick Amount
                </label>
                <div className="flex flex-wrap gap-1 sm:gap-2">
                  {QUICK_AMOUNTS.map((amt) => (
                    <button
                      key={amt}
                      onClick={() => setAmount(amt.toString())}
                      className={`px-4 py-2 text-sm border rounded transition-all ${
                        amount === amt.toString()
                          ? 'border-cyan text-cyan'
                          : 'border-gray-500/50 text-gray-400 hover:border-gray-400'
                      }`}
                    >
                      {amt} SOL
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-gray-400 text-xs uppercase tracking-wider mb-2">
                  Custom Amount (SOL)
                </label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  min="0.001"
                  max="1000"
                  step="0.001"
                  className="w-full bg-black border border-gray-500/50 rounded px-4 py-3 text-white text-sm focus:border-[#364153] focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-gray-400 text-xs uppercase tracking-wider mb-2">
                  Timelock
                </label>
                <div className="flex gap-2 flex-wrap">
                  {TIMELOCK_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setTimelock(opt.value)}
                      className={`px-4 py-2 text-sm border rounded transition-all ${
                        timelock === opt.value
                          ? 'border-magenta text-magenta'
                          : 'border-gray-500/50 text-gray-400 hover:border-gray-400'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {provider && (
                <div className="mt-6 p-4 bg-gray-900/50 rounded border border-gray-500/25">
                  <label className="block text-gray-400 text-xs uppercase tracking-wider mb-2">
                    Escrow URL
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={generateEscrowUrl()}
                      readOnly
                      className="flex-1 bg-black border border-gray-500/50 rounded px-3 py-2 text-cyan text-xs font-mono"
                    />
                    <button
                      onClick={copyEscrowUrl}
                      className="px-4 py-2 text-xs border border-gray-500/50 rounded text-gray-400 hover:text-white hover:border-gray-400 transition-all"
                    >
                      {copied ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                </div>
              )}

              <div className="pt-4 flex justify-center">
                <PayButton
                  text="Generate Link"
                  onClick={copyEscrowUrl}
                  disabled={!provider}
                />
              </div>
            </div>
          </div>

          {/* Reputation Lookup */}
          <div className="card relative p-6 rounded-xl border border-gray-500/25">
            <h2 className="text-xl text-white mb-6 pb-2 subheading-border">Check Reputation</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-gray-400 text-xs uppercase tracking-wider mb-2">
                  Wallet Address
                </label>
                <input
                  type="text"
                  value={reputationAddress}
                  onChange={(e) => setReputationAddress(e.target.value)}
                  placeholder="Solana wallet address"
                  className="w-full bg-black border border-gray-500/50 rounded px-4 py-3 text-white text-sm focus:border-[#364153] focus:outline-none transition-colors"
                />
              </div>

              <div className="pt-4 flex justify-center">
                <PayButton
                  text={loading ? 'Checking...' : 'Check Trust Score'}
                  disabled={loading || !reputationAddress}
                  onClick={checkReputation}
                />
              </div>

              {reputationData && !reputationData.error && (
                <div className="mt-6 p-4 bg-gray-900/50 rounded border border-gray-500/25 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400 text-sm">Trust Score</span>
                    <span className="text-2xl gradient-text font-medium">
                      {reputationData.title?.match(/(\d+)%/)?.[1] || '—'}%
                    </span>
                  </div>
                  <p className="text-gray-300 text-sm">{reputationData.description}</p>
                  <div className="flex gap-2 pt-2">
                    <span
                      className={`px-3 py-1 text-xs rounded ${
                        reputationData.label?.includes('Low')
                          ? 'bg-green-500/20 text-green-400'
                          : reputationData.label?.includes('Medium')
                          ? 'bg-yellow-500/20 text-yellow-400'
                          : 'bg-red-500/20 text-red-400'
                      }`}
                    >
                      {reputationData.label}
                    </span>
                  </div>
                </div>
              )}

              {reputationData?.error && (
                <div className="mt-6 p-4 bg-red-500/10 rounded border border-red-500/25">
                  <p className="text-red-400 text-sm">{reputationData.error}</p>
                </div>
              )}
            </div>
          </div>

          {/* Release/Dispute */}
          <div className="card relative p-6 rounded-xl border border-gray-500/25">
            <h2 className="text-xl text-white mb-6 pb-2 subheading-border">Manage Escrow</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-gray-400 text-xs uppercase tracking-wider mb-2">
                  Escrow ID
                </label>
                <input
                  type="text"
                  value={escrowId}
                  onChange={(e) => setEscrowId(e.target.value)}
                  placeholder="escrow_abc123..."
                  className="w-full bg-black border border-gray-500/50 rounded px-4 py-3 text-white text-sm focus:border-[#364153] focus:outline-none transition-colors"
                />
              </div>

              <div className="flex gap-4 pt-4">
                <a
                  href={escrowId ? `${API_BASE}/api/actions/release-escrow?escrowId=${escrowId}` : '#'}
                  className={`flex-1 text-center px-4 py-3 text-sm border rounded transition-all ${
                    escrowId
                      ? 'border-cyan text-cyan hover:bg-cyan/10'
                      : 'border-gray-500/25 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  Release Funds
                </a>
                <a
                  href={escrowId ? `${API_BASE}/api/actions/dispute?escrowId=${escrowId}` : '#'}
                  className={`flex-1 text-center px-4 py-3 text-sm border rounded transition-all ${
                    escrowId
                      ? 'border-magenta text-magenta hover:bg-magenta/10'
                      : 'border-gray-500/25 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  File Dispute
                </a>
              </div>
            </div>
          </div>

          {/* Info */}
          <div className="card relative p-6 rounded-xl border border-gray-500/25">
            <h2 className="text-xl text-white mb-6 pb-2 subheading-border">How It Works</h2>

            <div className="space-y-4 text-sm">
              <div className="flex gap-3">
                <span className="text-cyan">01</span>
                <p className="text-gray-400">Create an escrow with provider address, amount, and timelock period.</p>
              </div>
              <div className="flex gap-3">
                <span className="text-cyan">02</span>
                <p className="text-gray-400">Share the escrow URL. Anyone can execute the transaction via X or compatible wallets.</p>
              </div>
              <div className="flex gap-3">
                <span className="text-cyan">03</span>
                <p className="text-gray-400">Release funds after delivery, or file a dispute for oracle arbitration.</p>
              </div>
              <div className="flex gap-3">
                <span className="text-cyan">04</span>
                <p className="text-gray-400">Disputes are resolved by Switchboard oracles within 24-48 hours.</p>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-gray-500/25">
              <a
                href="https://kamiyo.ai/docs"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-magenta inline-flex items-center gap-2 no-underline hover:text-magenta"
              >
                Read Documentation
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
