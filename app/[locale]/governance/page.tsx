'use client';

import { useEffect, useState } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { GovernanceClient, Proposal, ProposalState, GovernanceConfig } from '@/lib/governance';
import { BN } from '@coral-xyz/anchor';

function formatTimeRemaining(endTime: BN, endedLabel: string, remainingLabel: string): string {
  const now = Math.floor(Date.now() / 1000);
  const remaining = endTime.toNumber() - now;

  if (remaining <= 0) return endedLabel;

  const days = Math.floor(remaining / 86400);
  const hours = Math.floor((remaining % 86400) / 3600);
  const minutes = Math.floor((remaining % 3600) / 60);

  if (days > 0) return `${days}d ${hours}h ${remainingLabel}`;
  if (hours > 0) return `${hours}h ${minutes}m ${remainingLabel}`;
  return `${minutes}m ${remainingLabel}`;
}

function ProposalCard({ proposal, config, t }: { proposal: Proposal; config: GovernanceConfig | null; t: ReturnType<typeof useTranslations> }) {
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

  const stateKeys: Record<ProposalState, string> = {
    [ProposalState.Voting]: 'active',
    [ProposalState.Queued]: 'queued',
    [ProposalState.Executed]: 'executed',
    [ProposalState.Defeated]: 'defeated',
    [ProposalState.Expired]: 'expired',
    [ProposalState.Cancelled]: 'cancelled',
  };

  return (
    <Link href={`/governance/${proposal.id.toString()}`}>
      <div className="card bg-black border border-gray-800 rounded-lg p-6 hover:border-transparent transition-all cursor-pointer">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <span className="text-gray-500 text-sm">#{proposal.id.toString()}</span>
            <span className={`text-sm font-medium ${stateColors[proposal.state]}`}>
              {t(`states.${stateKeys[proposal.state]}`)}
            </span>
          </div>
          {proposal.state === ProposalState.Voting && (
            <span className="text-xs text-gray-500">
              {formatTimeRemaining(proposal.votingEndsAt, t('ended'), t('remaining'))}
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
              <span>{t('approval')}</span>
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
              <span>{t('quorum')}</span>
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
          <span>{proposal.voterCount} {t('voters')}</span>
          <span>
            {(totalVotes.toNumber() / 1e6).toLocaleString(undefined, { maximumFractionDigits: 0 })} {t('votes')}
          </span>
        </div>
      </div>
    </Link>
  );
}

export default function GovernancePage() {
  const t = useTranslations('governance');
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
    <div className="min-h-screen pt-24 md:pt-28 pb-10 px-5 max-w-[1400px] mx-auto">
      <div className="subheading-border mb-10 pb-6">
        <p className="font-light text-sm uppercase tracking-widest gradient-text mb-4">
          — {t('subtitle')}
        </p>
        <h1 className="text-3xl md:text-4xl font-medium text-white">{t('title')}</h1>
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
              {t(`filters.${f}`)}
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
          {t('createProposal')}
        </Link>
      </div>

      {loading ? (
        <div className="text-center py-20 text-gray-500">
          {t('loading')}
        </div>
      ) : filteredProposals.length === 0 ? (
        <div className="text-center py-20 text-gray-500">
          {filter === 'all'
            ? t('noProposals')
            : filter === 'active'
              ? t('noActiveProposals')
              : t('noClosedProposals')}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filteredProposals.map((proposal) => (
            <ProposalCard
              key={proposal.id.toString()}
              proposal={proposal}
              config={config}
              t={t}
            />
          ))}
        </div>
      )}

      {config && (
        <div className="mt-12 p-6 bg-gray-900/50 border border-gray-800 rounded-lg">
          <h3 className="text-white font-medium mb-4">{t('parameters.title')}</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 text-xs md:text-sm">
            <div>
              <div className="text-gray-500 mb-1">{t('parameters.proposalThreshold')}</div>
              <div className="text-white">
                {(config.proposalThreshold.toNumber() / 1e6).toLocaleString()} KAMIYO
              </div>
            </div>
            <div>
              <div className="text-gray-500 mb-1">{t('parameters.quorum')}</div>
              <div className="text-white">
                {(config.quorumThreshold.toNumber() / 1e6).toLocaleString()} KAMIYO
              </div>
            </div>
            <div>
              <div className="text-gray-500 mb-1">{t('parameters.approvalThreshold')}</div>
              <div className="text-white">
                {(config.approvalThresholdBps.toNumber() / 100).toFixed(0)}%
              </div>
            </div>
            <div>
              <div className="text-gray-500 mb-1">{t('parameters.votingPeriod')}</div>
              <div className="text-white">
                {(config.votingPeriod.toNumber() / 86400).toFixed(0)} {t('parameters.days')}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
