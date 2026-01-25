'use client';

import { useState } from 'react';

type Phase = 'foundation' | 'expansion' | 'scale' | 'future';

interface Milestone {
  title: string;
  description: string;
  status: 'complete' | 'in-progress' | 'upcoming';
  quarter?: string;
}

interface PhaseData {
  id: Phase;
  name: string;
  subtitle: string;
  period: string;
  milestones: Milestone[];
}

const roadmapData: PhaseData[] = [
  {
    id: 'foundation',
    name: 'Phase 1',
    subtitle: 'Foundation',
    period: 'Q4 2024 - Q1 2025',
    milestones: [
      {
        title: 'Core Protocol Launch',
        description: 'Solana mainnet deployment with agent identity, escrow agreements, and dispute resolution.',
        status: 'complete',
      },
      {
        title: 'ZK Reputation Proofs',
        description: 'Groth16 verification for reputation threshold proofs without revealing exact scores.',
        status: 'complete',
      },
      {
        title: 'Oracle Consensus System',
        description: 'Multi-oracle commit-reveal voting with ZK proofs for private dispute resolution.',
        status: 'complete',
      },
      {
        title: 'x402 Payment Integration',
        description: 'HTTP 402 payment protocol with automatic escrow protection and SLA enforcement.',
        status: 'complete',
      },
      {
        title: 'Token Launch',
        description: '$KAMIYO token with transfer hook for MEV protection and governance rights.',
        status: 'complete',
      },
    ],
  },
  {
    id: 'expansion',
    name: 'Phase 2',
    subtitle: 'Expansion',
    period: 'Q2 2025',
    milestones: [
      {
        title: 'Governance System',
        description: 'Token-weighted voting with staking multipliers. Proposal creation, quorum tracking, and timelock execution.',
        status: 'complete',
      },
      {
        title: 'Staking Protocol',
        description: 'Single-sided staking with duration-based multipliers (1x-2x over 180 days).',
        status: 'complete',
      },
      {
        title: 'Agent Framework Integrations',
        description: 'ElizaOS, Daydreams, LangChain, Vercel AI SDK, and MCP server plugins.',
        status: 'in-progress',
      },
      {
        title: 'SwarmTeams',
        description: 'Multi-agent coordination with shared budgets, task proposals, and ZK-private voting.',
        status: 'in-progress',
      },
      {
        title: 'Base Mainnet',
        description: 'ZKReputation contract deployment on Base with Groth16 verifier.',
        status: 'complete',
      },
    ],
  },
  {
    id: 'scale',
    name: 'Phase 3',
    subtitle: 'Scale',
    period: 'Q3-Q4 2025',
    milestones: [
      {
        title: 'Monad Integration',
        description: 'Parallel execution, PDA emulation, agent proxy, and reputation mirror contracts.',
        status: 'upcoming',
      },
      {
        title: 'Hyperliquid Integration',
        description: 'Agent registry, vault integration, and copy trading for autonomous trading agents.',
        status: 'upcoming',
      },
      {
        title: 'Private Payments',
        description: 'ShadowWire integration via Radr for shielded transfers with escrow protection.',
        status: 'upcoming',
      },
      {
        title: 'Quality Oracle Network',
        description: 'Decentralized quality scoring via Switchboard and OriginTrail DKG oracles.',
        status: 'upcoming',
      },
      {
        title: 'Blindfold Card Issuance',
        description: 'ZK reputation-gated card issuance for agent spending in the physical world.',
        status: 'upcoming',
      },
    ],
  },
  {
    id: 'future',
    name: 'Phase 4',
    subtitle: 'Future',
    period: '2026+',
    milestones: [
      {
        title: 'Cross-Chain Settlement',
        description: 'Unified escrow and dispute resolution across Solana, Base, Monad, and Hyperliquid.',
        status: 'upcoming',
      },
      {
        title: 'Agent Reputation Portability',
        description: 'ZK proofs for transferring reputation across chains without revealing history.',
        status: 'upcoming',
      },
      {
        title: 'Autonomous Agent Mesh',
        description: 'Trustless agent-to-agent payments and service agreements without human intervention.',
        status: 'upcoming',
      },
      {
        title: 'Halo2 Migration',
        description: 'Move from Groth16 to Halo2-based proofs for trustless setup and faster verification.',
        status: 'upcoming',
      },
    ],
  },
];

function StatusBadge({ status }: { status: Milestone['status'] }) {
  const styles = {
    complete: 'bg-green-500/20 text-green-400 border-green-500/30',
    'in-progress': 'bg-cyan/20 text-cyan border-cyan/30',
    upcoming: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  };

  const labels = {
    complete: 'Complete',
    'in-progress': 'In Progress',
    upcoming: 'Upcoming',
  };

  return (
    <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded border ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}

function MilestoneCard({ milestone }: { milestone: Milestone }) {
  return (
    <div className="card bg-black border border-gray-800 rounded-lg p-5 hover:border-transparent transition-all">
      <div className="flex items-start justify-between gap-3 mb-3">
        <h4 className="text-white font-medium">{milestone.title}</h4>
        <StatusBadge status={milestone.status} />
      </div>
      <p className="text-sm text-gray-500 leading-relaxed">{milestone.description}</p>
    </div>
  );
}

function PhaseSection({ phase, isActive }: { phase: PhaseData; isActive: boolean }) {
  const completedCount = phase.milestones.filter(m => m.status === 'complete').length;
  const progressPercent = (completedCount / phase.milestones.length) * 100;

  return (
    <div className={`transition-opacity duration-300 ${isActive ? 'opacity-100' : 'opacity-50'}`}>
      <div className="flex items-center gap-4 mb-6">
        <div className="flex-shrink-0">
          <div className="w-12 h-12 rounded-full border border-gray-700 flex items-center justify-center bg-black">
            <span className="text-xs text-gray-400 font-mono">{phase.id === 'foundation' ? '01' : phase.id === 'expansion' ? '02' : phase.id === 'scale' ? '03' : '04'}</span>
          </div>
        </div>
        <div className="flex-1">
          <div className="flex items-baseline gap-3">
            <h3 className="text-xl text-white font-medium">{phase.subtitle}</h3>
            <span className="text-xs text-gray-600">{phase.period}</span>
          </div>
          <div className="mt-2 h-1 bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-cyan to-magenta transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="mt-1 text-xs text-gray-600">
            {completedCount}/{phase.milestones.length} complete
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 ml-16">
        {phase.milestones.map((milestone, idx) => (
          <MilestoneCard key={idx} milestone={milestone} />
        ))}
      </div>
    </div>
  );
}

export default function RoadmapPage() {
  const [activePhase, setActivePhase] = useState<Phase | 'all'>('all');

  const filteredPhases = activePhase === 'all'
    ? roadmapData
    : roadmapData.filter(p => p.id === activePhase);

  return (
    <div className="min-h-screen pt-24 md:pt-28 pb-10 px-5 max-w-[1400px] mx-auto">
      <div className="subheading-border mb-10 pb-6">
        <p className="font-light text-sm uppercase tracking-widest gradient-text mb-4">
          — Roadmap
        </p>
        <h1 className="text-3xl md:text-4xl font-medium text-white">Development Timeline</h1>
        <p className="text-gray-500 mt-4 max-w-2xl">
          Building trust infrastructure for autonomous agents. From Solana to multi-chain,
          from escrow to cross-chain settlement.
        </p>
      </div>

      {/* Phase filter */}
      <div className="flex flex-wrap gap-2 mb-10">
        {(['all', ...roadmapData.map(p => p.id)] as const).map((filter) => {
          const label = filter === 'all' ? 'All Phases' : roadmapData.find(p => p.id === filter)?.subtitle;
          return (
            <button
              key={filter}
              onClick={() => setActivePhase(filter)}
              className={`px-4 py-2 text-sm rounded transition-colors ${
                activePhase === filter
                  ? 'bg-white/10 text-white'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Timeline */}
      <div className="space-y-16">
        {filteredPhases.map((phase) => (
          <PhaseSection
            key={phase.id}
            phase={phase}
            isActive={activePhase === 'all' || activePhase === phase.id}
          />
        ))}
      </div>

      {/* Stats summary */}
      <div className="mt-16 p-6 bg-gray-900/50 border border-gray-800 rounded-lg">
        <h3 className="text-white font-medium mb-4">Progress Overview</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div>
            <div className="text-2xl text-white font-medium">
              {roadmapData.reduce((acc, p) => acc + p.milestones.filter(m => m.status === 'complete').length, 0)}
            </div>
            <div className="text-xs text-gray-500 mt-1">Completed</div>
          </div>
          <div>
            <div className="text-2xl text-cyan font-medium">
              {roadmapData.reduce((acc, p) => acc + p.milestones.filter(m => m.status === 'in-progress').length, 0)}
            </div>
            <div className="text-xs text-gray-500 mt-1">In Progress</div>
          </div>
          <div>
            <div className="text-2xl text-gray-400 font-medium">
              {roadmapData.reduce((acc, p) => acc + p.milestones.filter(m => m.status === 'upcoming').length, 0)}
            </div>
            <div className="text-xs text-gray-500 mt-1">Upcoming</div>
          </div>
          <div>
            <div className="text-2xl text-white font-medium">4</div>
            <div className="text-xs text-gray-500 mt-1">Chains</div>
          </div>
        </div>
      </div>
    </div>
  );
}
