'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import Link from 'next/link';
import { GovernanceClient, GovernanceConfig } from '@/lib/governance';
import { BN } from '@coral-xyz/anchor';
import * as anchor from '@coral-xyz/anchor';
import governanceIdl from '@/lib/kamiyo_governance.json';

export default function CreateProposalPage() {
  const router = useRouter();
  const { connection } = useConnection();
  const wallet = useWallet();
  const { setVisible } = useWalletModal();

  const [config, setConfig] = useState<GovernanceConfig | null>(null);
  const [tokenBalance, setTokenBalance] = useState<BN>(new BN(0));
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const client = new GovernanceClient(connection);
        const configData = await client.getConfig();
        setConfig(configData);

        if (wallet.publicKey) {
          const weight = await client.calculateVoteWeight(wallet.publicKey);
          setTokenBalance(weight);
        }
      } catch (error) {
        console.error('Failed to fetch config:', error);
      }
    };

    fetchData();
  }, [connection, wallet.publicKey]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!wallet.publicKey || !wallet.signTransaction) {
      setVisible(true);
      return;
    }

    if (!title.trim() || !description.trim()) {
      setError('Title and description are required');
      return;
    }

    if (title.length > 128) {
      setError('Title must be 128 characters or less');
      return;
    }

    if (description.length > 1024) {
      setError('Description must be 1024 characters or less');
      return;
    }

    if (config && tokenBalance.lt(config.proposalThreshold)) {
      setError(
        `You need at least ${(config.proposalThreshold.toNumber() / 1e6).toLocaleString()} KAMIYO to create a proposal`
      );
      return;
    }

    setSubmitting(true);
    try {
      const anchorWallet = {
        publicKey: wallet.publicKey,
        signTransaction: wallet.signTransaction,
        signAllTransactions: wallet.signAllTransactions!,
      };
      const client = new GovernanceClient(connection, anchorWallet as anchor.Wallet);
      await client.initializeProgram(governanceIdl);
      await client.createProposal(title.trim(), description.trim());
      router.push('/governance');
    } catch (error: any) {
      console.error('Failed to create proposal:', error);
      setError(error.message || 'Failed to create proposal');
    } finally {
      setSubmitting(false);
    }
  };

  const meetsThreshold = config ? tokenBalance.gte(config.proposalThreshold) : false;

  return (
    <div className="min-h-screen pt-24 md:pt-28 pb-10 px-5 max-w-[1400px] mx-auto">
      <Link
        href="/governance"
        className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-300 mb-8 text-sm"
      >
        ← Back to proposals
      </Link>

      <div className="subheading-border mb-8 pb-6">
        <h1 className="text-2xl md:text-3xl font-medium text-white">Create Proposal</h1>
      </div>

      {config && (
        <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4 mb-8">
          <div className="flex justify-between items-center">
            <div>
              <div className="text-gray-500 text-sm">Required to propose</div>
              <div className="text-white">
                {(config.proposalThreshold.toNumber() / 1e6).toLocaleString()} KAMIYO
              </div>
            </div>
            {wallet.publicKey && (
              <div className="text-right">
                <div className="text-gray-500 text-sm">Your balance</div>
                <div className={meetsThreshold ? 'text-green-500' : 'text-red-500'}>
                  {(tokenBalance.toNumber() / 1e6).toLocaleString()} KAMIYO
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {!wallet.publicKey ? (
        <div className="text-center py-12">
          <p className="text-gray-500 mb-4">Connect your wallet to create a proposal</p>
          <button
            onClick={() => setVisible(true)}
            className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded transition-colors"
          >
            Connect Wallet
          </button>
        </div>
      ) : !meetsThreshold ? (
        <div className="text-center py-12">
          <p className="text-gray-500 mb-2">Insufficient tokens to create a proposal</p>
          <p className="text-sm text-gray-600">
            You need at least{' '}
            {config
              ? (config.proposalThreshold.toNumber() / 1e6).toLocaleString()
              : '100,000'}{' '}
            KAMIYO
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-red-500/10 border border-red-500/50 text-red-500 px-4 py-3 rounded">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="title" className="block text-white mb-2">
              Title
            </label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={128}
              placeholder="Brief summary of your proposal"
              className="w-full px-4 py-3 bg-black border border-gray-700 rounded text-white placeholder-gray-500 focus:outline-none focus:border-cyan/50"
            />
            <div className="text-right text-xs text-gray-500 mt-1">
              {title.length}/128
            </div>
          </div>

          <div>
            <label htmlFor="description" className="block text-white mb-2">
              Description
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={1024}
              rows={8}
              placeholder="Detailed explanation of the proposal, its rationale, and expected impact"
              className="w-full px-4 py-3 bg-black border border-gray-700 rounded text-white placeholder-gray-500 focus:outline-none focus:border-cyan/50 resize-none"
            />
            <div className="text-right text-xs text-gray-500 mt-1">
              {description.length}/1024
            </div>
          </div>

          <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4 text-sm text-gray-400">
            <p className="mb-2">
              <strong className="text-white">Voting period:</strong>{' '}
              {config ? `${(config.votingPeriod.toNumber() / 86400).toFixed(0)} days` : '3 days'}
            </p>
            <p className="mb-2">
              <strong className="text-white">Quorum required:</strong>{' '}
              {config
                ? `${(config.quorumThreshold.toNumber() / 1e6).toLocaleString()} KAMIYO`
                : '5M KAMIYO'}
            </p>
            <p>
              <strong className="text-white">Approval threshold:</strong>{' '}
              {config ? `${(config.approvalThresholdBps.toNumber() / 100).toFixed(0)}%` : '66%'}
            </p>
          </div>

          <button
            type="submit"
            disabled={submitting || !title.trim() || !description.trim()}
            className="w-full py-3 bg-gradient-to-r from-cyan to-magenta text-white font-medium rounded transition-opacity disabled:opacity-50"
          >
            {submitting ? 'Creating Proposal...' : 'Create Proposal'}
          </button>
        </form>
      )}
    </div>
  );
}
