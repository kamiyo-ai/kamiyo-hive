'use client';

import { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useReputationProof } from '@/hooks/useReputationProof';
import { PAYMENT_TIERS, getTierForReputation } from '@/lib/reputation-tiers';
import PayButton from '@/components/PayButton';

interface Props {
  onVerified?: (tier: keyof typeof PAYMENT_TIERS) => void;
}

export function ReputationProof({ onVerified }: Props) {
  const wallet = useWallet();
  const [reputationScore, setReputationScore] = useState(85);
  const [transactionCount, setTransactionCount] = useState(60);

  const {
    generating,
    verifying,
    error,
    proof,
    txSignature,
    generateProof,
    verifyOnChain,
    currentTier,
  } = useReputationProof(reputationScore, transactionCount);

  const tierConfig = PAYMENT_TIERS[currentTier];

  const handleGenerateAndVerify = async () => {
    const tier = getTierForReputation(reputationScore, transactionCount);
    const tierReq = PAYMENT_TIERS[tier];

    const result = await generateProof({
      reputationScore,
      transactionCount,
      minReputation: tierReq.minReputation,
      minTransactions: tierReq.minTransactions,
    });

    if (result && wallet.publicKey) {
      const sig = await verifyOnChain(result);
      if (sig && onVerified) {
        onVerified(tier);
      }
    }
  };

  const tierStyles: Record<string, { color: string; borderColor: string }> = {
    elite: { color: '', borderColor: 'transparent' },
    premium: { color: '#00f0ff', borderColor: 'rgba(0, 240, 255, 0.5)' },
    basic: { color: '#ff44f5', borderColor: 'rgba(255, 68, 245, 0.5)' },
    standard: { color: '#9ca3af', borderColor: 'rgba(107, 114, 128, 0.5)' },
  };

  const buttonText = generating
    ? 'Generating...'
    : verifying
      ? 'Verifying...'
      : !wallet.publicKey
        ? 'Connect Wallet'
        : `Prove ${currentTier.charAt(0).toUpperCase() + currentTier.slice(1)} Tier`;

  return (
    <div className="card bg-black/30 border border-gray-500/25 rounded-lg p-6 space-y-4">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-xs uppercase tracking-wider text-gray-400">
          ZK Reputation
        </h3>
        <span
          className={`px-2 py-1 text-xs rounded border ${currentTier === 'elite' ? 'gradient-text' : ''}`}
          style={{
            color: tierStyles[currentTier].color || undefined,
            borderColor: tierStyles[currentTier].borderColor
          }}
        >
          {currentTier.toUpperCase()}
        </span>
      </div>
      <p className="text-xs text-gray-600 mb-2">
        Prove your tier on-chain without revealing your actual score.
      </p>

      <div className="space-y-4">
        <div>
          <div className="flex justify-between text-xs text-gray-500 mb-2">
            <span>Reputation Score</span>
            <span className="text-cyan">{reputationScore}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={reputationScore}
            onChange={(e) => setReputationScore(parseInt(e.target.value))}
            className="w-full h-1 bg-gray-800 rounded appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-cyan [&::-webkit-slider-thumb]:rounded-full"
          />
        </div>

        <div>
          <div className="flex justify-between text-xs text-gray-500 mb-2">
            <span>Transaction Count</span>
            <span className="text-cyan">{transactionCount}</span>
          </div>
          <input
            type="range"
            min="0"
            max="200"
            value={transactionCount}
            onChange={(e) => setTransactionCount(parseInt(e.target.value))}
            className="w-full h-1 bg-gray-800 rounded appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-cyan [&::-webkit-slider-thumb]:rounded-full"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="bg-black border border-gray-500/25 rounded p-3 text-center">
          <div className="gradient-text text-[10px] uppercase tracking-wider mb-1">Daily Limit</div>
          <div className="text-white text-lg font-light">${tierConfig.dailyLimit.toLocaleString('en-US')}</div>
        </div>
        <div className="bg-black border border-gray-500/25 rounded p-3 text-center">
          <div className="gradient-text text-[10px] uppercase tracking-wider mb-1">Min Rep</div>
          <div className="text-white text-lg font-light">{tierConfig.minReputation}%</div>
        </div>
      </div>

      {proof && (
        <div className="rounded p-3 text-xs" style={{ backgroundColor: 'rgba(0, 240, 255, 0.05)', border: '1px solid rgba(0, 240, 255, 0.25)' }}>
          <div className="mb-1" style={{ color: '#00f0ff' }}>Proof Generated</div>
          <div className="text-gray-500 break-all font-mono">
            0x{Array.from(proof.publicInputs.nullifier.slice(0, 8))
              .map(b => b.toString(16).padStart(2, '0')).join('')}...
          </div>
        </div>
      )}

      {txSignature && (
        <div className="rounded p-3 text-xs" style={{ backgroundColor: 'rgba(0, 240, 255, 0.05)', border: '1px solid rgba(0, 240, 255, 0.25)' }}>
          <div className="mb-1" style={{ color: '#00f0ff' }}>Verified On-Chain</div>
          <a
            href={`https://solscan.io/tx/${txSignature}`}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-white transition-colors break-all"
            style={{ color: '#ff44f5' }}
          >
            View on Solscan
          </a>
        </div>
      )}

      {error && (
        <div className="rounded p-3 text-xs" style={{ backgroundColor: 'rgba(255, 50, 50, 0.05)', border: '1px solid rgba(255, 50, 50, 0.25)', color: '#ff3232' }}>
          {error}
        </div>
      )}

      <div className="flex justify-center pt-2">
        <PayButton
          text={buttonText}
          onClick={handleGenerateAndVerify}
          disabled={generating || verifying || !wallet.publicKey}
        />
      </div>

    </div>
  );
}
