'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import Link from 'next/link';
import { GovernanceClient, Proposal, ProposalState, GovernanceConfig, VoteRecord } from '@/lib/governance';
import { BN } from '@coral-xyz/anchor';
import * as anchor from '@coral-xyz/anchor';
import governanceIdl from '@/lib/kamiyo_governance.json';

function formatDate(timestamp: BN): string {
  return new Date(timestamp.toNumber() * 1000).toLocaleString();
}

function formatTimeRemaining(endTime: BN): string {
  const now = Math.floor(Date.now() / 1000);
  const remaining = endTime.toNumber() - now;

  if (remaining <= 0) return 'Ended';

  const days = Math.floor(remaining / 86400);
  const hours = Math.floor((remaining % 86400) / 3600);
  const minutes = Math.floor((remaining % 3600) / 60);

  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export default function ProposalDetailPage() {
  const params = useParams();
  const proposalId = params.id as string;
  const { connection } = useConnection();
  const wallet = useWallet();
  const { setVisible } = useWalletModal();

  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [config, setConfig] = useState<GovernanceConfig | null>(null);
  const [voteRecord, setVoteRecord] = useState<VoteRecord | null>(null);
  const [voteWeight, setVoteWeight] = useState<BN>(new BN(0));
  const [loading, setLoading] = useState(true);
  const [voting, setVoting] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [executing, setExecuting] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const client = new GovernanceClient(connection);
      const id = new BN(proposalId);

      const [proposalData, configData] = await Promise.all([
        client.getProposal(id),
        client.getConfig(),
      ]);

      setProposal(proposalData);
      setConfig(configData);

      if (wallet.publicKey && proposalData) {
        const [proposalPDA] = client.getProposalPDA(id);
        const [voteData, weight] = await Promise.all([
          client.getVoteRecord(proposalPDA, wallet.publicKey),
          client.calculateVoteWeight(wallet.publicKey),
        ]);
        setVoteRecord(voteData);
        setVoteWeight(weight);
      }
    } catch (error) {
      console.error('Failed to fetch proposal:', error);
    } finally {
      setLoading(false);
    }
  }, [connection, proposalId, wallet.publicKey]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleVote = async (support: boolean) => {
    if (!wallet.publicKey || !wallet.signTransaction) {
      setVisible(true);
      return;
    }

    setVoting(true);
    try {
      const anchorWallet = {
        publicKey: wallet.publicKey,
        signTransaction: wallet.signTransaction,
        signAllTransactions: wallet.signAllTransactions!,
      };
      const client = new GovernanceClient(connection, anchorWallet as anchor.Wallet);
      await client.initializeProgram(governanceIdl);
      await client.castVote(new BN(proposalId), support);
      await fetchData();
    } catch (error: any) {
      console.error('Failed to vote:', error);
      alert(error.message || 'Failed to cast vote');
    } finally {
      setVoting(false);
    }
  };

  const handleFinalize = async () => {
    if (!wallet.publicKey || !wallet.signTransaction) {
      setVisible(true);
      return;
    }

    setFinalizing(true);
    try {
      const anchorWallet = {
        publicKey: wallet.publicKey,
        signTransaction: wallet.signTransaction,
        signAllTransactions: wallet.signAllTransactions!,
      };
      const client = new GovernanceClient(connection, anchorWallet as anchor.Wallet);
      await client.initializeProgram(governanceIdl);
      await client.finalizeProposal(new BN(proposalId));
      await fetchData();
    } catch (error: any) {
      console.error('Failed to finalize:', error);
      alert(error.message || 'Failed to finalize proposal');
    } finally {
      setFinalizing(false);
    }
  };

  const handleExecute = async () => {
    if (!wallet.publicKey || !wallet.signTransaction) {
      setVisible(true);
      return;
    }

    setExecuting(true);
    try {
      const anchorWallet = {
        publicKey: wallet.publicKey,
        signTransaction: wallet.signTransaction,
        signAllTransactions: wallet.signAllTransactions!,
      };
      const client = new GovernanceClient(connection, anchorWallet as anchor.Wallet);
      await client.initializeProgram(governanceIdl);
      await client.executeProposal(new BN(proposalId));
      await fetchData();
    } catch (error: any) {
      console.error('Failed to execute:', error);
      alert(error.message || 'Failed to execute proposal');
    } finally {
      setExecuting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen pt-24 md:pt-28 pb-10 px-5 max-w-[1400px] mx-auto">
        <div className="text-center py-20 text-gray-500">Loading proposal...</div>
      </div>
    );
  }

  if (!proposal) {
    return (
      <div className="min-h-screen pt-24 md:pt-28 pb-10 px-5 max-w-[1400px] mx-auto">
        <div className="text-center py-20 text-gray-500">Proposal not found</div>
      </div>
    );
  }

  const totalVotes = proposal.votesFor.add(proposal.votesAgainst);
  const approvalPercent = totalVotes.isZero()
    ? 0
    : proposal.votesFor.muln(100).div(totalVotes).toNumber();
  const quorumPercent = config
    ? Math.min(100, totalVotes.muln(100).div(config.quorumThreshold).toNumber())
    : 0;

  const canVote = proposal.state === ProposalState.Voting && !voteRecord && voteWeight.gtn(0);
  const canFinalize =
    proposal.state === ProposalState.Voting &&
    new BN(Math.floor(Date.now() / 1000)).gte(proposal.votingEndsAt);
  const canExecute =
    proposal.state === ProposalState.Queued &&
    new BN(Math.floor(Date.now() / 1000)).gte(proposal.executionEta);

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
    <div className="min-h-screen pt-24 md:pt-28 pb-10 px-5 max-w-[1400px] mx-auto">
      <Link
        href="/governance"
        className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-300 mb-8 text-sm"
      >
        ← Back to proposals
      </Link>

      <div className="mb-8">
        <div className="flex items-center gap-4 mb-4">
          <span className="text-gray-500">#{proposal.id.toString()}</span>
          <span className={`font-medium ${stateColors[proposal.state]}`}>
            {stateLabels[proposal.state]}
          </span>
        </div>
        <h1 className="text-2xl md:text-3xl font-medium text-white mb-4">
          {proposal.title}
        </h1>
        <p className="text-gray-400 whitespace-pre-wrap">{proposal.description}</p>
      </div>

      <div className="grid md:grid-cols-3 gap-6 mb-8">
        <div className="md:col-span-2 space-y-6">
          {/* Voting Progress */}
          <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-6">
            <h3 className="text-white font-medium mb-4">Voting Progress</h3>

            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-green-500">For</span>
                  <span className="text-gray-400">
                    {(proposal.votesFor.toNumber() / 1e6).toLocaleString()} KAMIYO
                  </span>
                </div>
                <div className="h-3 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-500 transition-all"
                    style={{
                      width: totalVotes.isZero()
                        ? '0%'
                        : `${proposal.votesFor.muln(100).div(totalVotes).toNumber()}%`,
                    }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-red-500">Against</span>
                  <span className="text-gray-400">
                    {(proposal.votesAgainst.toNumber() / 1e6).toLocaleString()} KAMIYO
                  </span>
                </div>
                <div className="h-3 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-red-500 transition-all"
                    style={{
                      width: totalVotes.isZero()
                        ? '0%'
                        : `${proposal.votesAgainst.muln(100).div(totalVotes).toNumber()}%`,
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-gray-800 grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-gray-500 mb-1">Approval</div>
                <div className="text-white text-lg">{approvalPercent.toFixed(1)}%</div>
                <div className="text-gray-500 text-xs">
                  {config ? `${(config.approvalThresholdBps.toNumber() / 100).toFixed(0)}% required` : ''}
                </div>
              </div>
              <div>
                <div className="text-gray-500 mb-1">Quorum</div>
                <div className="text-white text-lg">{quorumPercent.toFixed(1)}%</div>
                <div className="text-gray-500 text-xs">
                  {config
                    ? `${(config.quorumThreshold.toNumber() / 1e6).toLocaleString()} KAMIYO required`
                    : ''}
                </div>
              </div>
            </div>
          </div>

          {/* Vote Action */}
          {proposal.state === ProposalState.Voting && (
            <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-6">
              <h3 className="text-white font-medium mb-4">Cast Your Vote</h3>

              {!wallet.publicKey ? (
                <button
                  onClick={() => setVisible(true)}
                  className="w-full py-3 bg-white/10 hover:bg-white/20 text-white rounded transition-colors"
                >
                  Connect Wallet to Vote
                </button>
              ) : voteRecord ? (
                <div className="text-center py-4">
                  <div className="text-gray-500 mb-2">You voted</div>
                  <div
                    className={`text-xl font-medium ${
                      voteRecord.support ? 'text-green-500' : 'text-red-500'
                    }`}
                  >
                    {voteRecord.support ? 'For' : 'Against'}
                  </div>
                  <div className="text-gray-500 text-sm mt-1">
                    {(voteRecord.weight.toNumber() / 1e6).toLocaleString()} KAMIYO
                  </div>
                </div>
              ) : (
                <>
                  <div className="text-sm text-gray-400 mb-4">
                    Your voting power:{' '}
                    <span className="text-white">
                      {(voteWeight.toNumber() / 1e6).toLocaleString()} KAMIYO
                    </span>
                  </div>
                  {voteWeight.isZero() ? (
                    <p className="text-gray-500 text-sm">
                      You need KAMIYO tokens to vote on proposals.
                    </p>
                  ) : (
                    <div className="grid grid-cols-2 gap-4">
                      <button
                        onClick={() => handleVote(true)}
                        disabled={voting}
                        className="py-3 bg-green-500/20 hover:bg-green-500/30 text-green-500 border border-green-500/50 rounded transition-colors disabled:opacity-50"
                      >
                        {voting ? 'Voting...' : 'Vote For'}
                      </button>
                      <button
                        onClick={() => handleVote(false)}
                        disabled={voting}
                        className="py-3 bg-red-500/20 hover:bg-red-500/30 text-red-500 border border-red-500/50 rounded transition-colors disabled:opacity-50"
                      >
                        {voting ? 'Voting...' : 'Vote Against'}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Finalize */}
          {canFinalize && (
            <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-6">
              <h3 className="text-white font-medium mb-2">Finalize Proposal</h3>
              <p className="text-gray-500 text-sm mb-4">
                Voting has ended. Finalize the proposal to determine the outcome.
              </p>
              <button
                onClick={handleFinalize}
                disabled={finalizing}
                className="w-full py-3 bg-cyan/20 hover:bg-cyan/30 text-cyan border border-cyan/50 rounded transition-colors disabled:opacity-50"
              >
                {finalizing ? 'Finalizing...' : 'Finalize Proposal'}
              </button>
            </div>
          )}

          {/* Execute */}
          {canExecute && (
            <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-6">
              <h3 className="text-white font-medium mb-2">Execute Proposal</h3>
              <p className="text-gray-500 text-sm mb-4">
                Timelock period has ended. Execute the proposal to apply changes.
              </p>
              <button
                onClick={handleExecute}
                disabled={executing}
                className="w-full py-3 bg-green-500/20 hover:bg-green-500/30 text-green-500 border border-green-500/50 rounded transition-colors disabled:opacity-50"
              >
                {executing ? 'Executing...' : 'Execute Proposal'}
              </button>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
            <h4 className="text-gray-500 text-xs uppercase tracking-wider mb-3">Details</h4>
            <div className="space-y-3 text-sm">
              <div>
                <div className="text-gray-500">Proposer</div>
                <a
                  href={`https://solscan.io/account/${proposal.proposer.toBase58()}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-cyan hover:underline font-mono text-xs"
                >
                  {proposal.proposer.toBase58().slice(0, 8)}...
                </a>
              </div>
              <div>
                <div className="text-gray-500">Created</div>
                <div className="text-white">{formatDate(proposal.createdAt)}</div>
              </div>
              {proposal.state === ProposalState.Voting && (
                <div>
                  <div className="text-gray-500">Voting Ends</div>
                  <div className="text-white">{formatTimeRemaining(proposal.votingEndsAt)}</div>
                </div>
              )}
              {proposal.state === ProposalState.Queued && (
                <div>
                  <div className="text-gray-500">Executable After</div>
                  <div className="text-white">{formatDate(proposal.executionEta)}</div>
                </div>
              )}
              <div>
                <div className="text-gray-500">Voters</div>
                <div className="text-white">{proposal.voterCount}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
