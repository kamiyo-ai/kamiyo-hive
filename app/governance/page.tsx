'use client';

import { useEffect, useState } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import Link from 'next/link';
import { GovernanceClient, Proposal, ProposalState, GovernanceConfig } from '@/lib/governance';
import { BN } from '@coral-xyz/anchor';

function formatTimeRemaining(endTime: BN): string {
  const now = Math.floor(Date.now() / 1000);
  const remaining = endTime.toNumber() - now;

  if (remaining <= 0) return 'Ended';

  const days = Math.floor(remaining / 86400);
  const hours = Math.floor((remaining % 86400) / 3600);
  const minutes = Math.floor((remaining % 3600) / 60);

  if (days > 0) return `${days}d ${hours}h remaining`;
  if (hours > 0) return `${hours}h ${minutes}m remaining`;
  return `${minutes}m remaining`;
}

function ProposalCard({ proposal, config }: { proposal: Proposal; config: GovernanceConfig | null }) {
  const totalVotes = proposal.votesFor.add(proposal.votesAgainst);
  const approvalPercent = totalVotes.isZero()
    ? 0
    : proposal.votesFor.muln(100).div(totalVotes).toNumber();
  const quorumPercent = config
    ? Math.min(100, totalVotes.muln(100).div(config.quorumThreshold).toNumber())
    : 0;

  const stateColors: Record<ProposalState, string> = {
    [ProposalState.Voting]: 'text-cyan',
    [ProposalState.Queued]: 'text-yellow-500',
    [ProposalState.Executed]: 'text-green-500',
    [ProposalState.Defeated]: 'text-red-500',
    [ProposalState.Expired]: 'text-gray-500',
    [ProposalState.Cancelled]: 'text-gray-500',
  };

  const stateLabels: Record<ProposalState, string> = {
    [ProposalState.Voting]: 'Active',
    [ProposalState.Queued]: 'Queued',
    [ProposalState.Executed]: 'Executed',
    [ProposalState.Defeated]: 'Defeated',
    [ProposalState.Expired]: 'Expired',
    [ProposalState.Cancelled]: 'Cancelled',
  };

  return (
    <Link href={`/governance/${proposal.id.toString()}`}>
      <div className="card bg-black border border-gray-800 rounded-lg p-6 hover:border-transparent transition-all cursor-pointer">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <span className="text-gray-500 text-sm">#{proposal.id.toString()}</span>
            <span className={`text-sm font-medium ${stateColors[proposal.state]}`}>
              {stateLabels[proposal.state]}
            </span>
          </div>
          {proposal.state === ProposalState.Voting && (
            <span className="text-xs text-gray-500">
              {formatTimeRemaining(proposal.votingEndsAt)}
            </span>
          )}
        </div>

        <h3 className="text-lg text-white font-medium mb-2 line-clamp-2">
          {proposal.title}
        </h3>

        <p className="text-sm text-gray-500 mb-4 line-clamp-2">
          {proposal.description}
        </p>

        <div className="space-y-3">
          <div>
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>Approval</span>
              <span>{approvalPercent.toFixed(1)}%</span>
            </div>
            <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-cyan to-magenta transition-all"
                style={{ width: `${approvalPercent}%` }}
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>Quorum</span>
              <span>{quorumPercent.toFixed(1)}%</span>
            </div>
            <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gray-600 transition-all"
                style={{ width: `${quorumPercent}%` }}
              />
            </div>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-gray-800 flex justify-between text-xs text-gray-500">
          <span>{proposal.voterCount} voters</span>
          <span>
            {(totalVotes.toNumber() / 1e6).toLocaleString(undefined, { maximumFractionDigits: 0 })} votes
          </span>
        </div>
      </div>
    </Link>
  );
}

export default function GovernancePage() {
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [config, setConfig] = useState<GovernanceConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'closed'>('all');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const client = new GovernanceClient(connection);
        const [configData, proposalsData] = await Promise.all([
          client.getConfig(),
          client.getAllProposals(),
        ]);
        setConfig(configData);
        setProposals(proposalsData.reverse());
      } catch (error) {
        console.error('Failed to fetch governance data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [connection]);

  const filteredProposals = proposals.filter((p) => {
    if (filter === 'active') return p.state === ProposalState.Voting;
    if (filter === 'closed') return p.state !== ProposalState.Voting;
    return true;
  });

  const activeCount = proposals.filter(p => p.state === ProposalState.Voting).length;

  return (
    <div className="min-h-screen py-10 px-5 max-w-[1400px] mx-auto">
      <div className="subheading-border mb-10 pb-6">
        <p className="font-light text-sm uppercase tracking-widest gradient-text mb-4">
          — Governance ガバナンス
        </p>
        <h1 className="text-3xl md:text-4xl font-medium text-white">Proposals</h1>
      </div>

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <div className="flex gap-2">
          {(['all', 'active', 'closed'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 text-sm rounded transition-colors ${
                filter === f
                  ? 'bg-white/10 text-white'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
              {f === 'active' && activeCount > 0 && (
                <span className="ml-2 text-cyan">{activeCount}</span>
              )}
            </button>
          ))}
        </div>

        <Link
          href="/governance/create"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-white/5 border border-gray-700 hover:border-cyan/50 text-white text-sm rounded transition-colors"
        >
          <span>+</span>
          Create Proposal
        </Link>
      </div>

      {loading ? (
        <div className="text-center py-20 text-gray-500">
          Loading proposals...
        </div>
      ) : filteredProposals.length === 0 ? (
        <div className="text-center py-20 text-gray-500">
          {filter === 'all'
            ? 'No proposals yet'
            : `No ${filter} proposals`}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filteredProposals.map((proposal) => (
            <ProposalCard
              key={proposal.id.toString()}
              proposal={proposal}
              config={config}
            />
          ))}
        </div>
      )}

      {config && (
        <div className="mt-12 p-6 bg-gray-900/50 border border-gray-800 rounded-lg">
          <h3 className="text-white font-medium mb-4">Governance Parameters</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 text-xs md:text-sm">
            <div>
              <div className="text-gray-500 mb-1">Proposal Threshold</div>
              <div className="text-white">
                {(config.proposalThreshold.toNumber() / 1e6).toLocaleString()} KAMIYO
              </div>
            </div>
            <div>
              <div className="text-gray-500 mb-1">Quorum</div>
              <div className="text-white">
                {(config.quorumThreshold.toNumber() / 1e6).toLocaleString()} KAMIYO
              </div>
            </div>
            <div>
              <div className="text-gray-500 mb-1">Approval Threshold</div>
              <div className="text-white">
                {(config.approvalThresholdBps.toNumber() / 100).toFixed(0)}%
              </div>
            </div>
            <div>
              <div className="text-gray-500 mb-1">Voting Period</div>
              <div className="text-white">
                {(config.votingPeriod.toNumber() / 86400).toFixed(0)} days
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
