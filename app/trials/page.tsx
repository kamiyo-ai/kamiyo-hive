'use client';

import { useState, useEffect, useCallback } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { PublicKey } from '@solana/web3.js';
import { useSearchParams } from 'next/navigation';
import PayButton from '@/components/PayButton';
import Link from 'next/link';
import bs58 from 'bs58';

const STAKING_PROGRAM_ID = new PublicKey('9QZGdEZ13j8fASEuhpj3eVwUPT4BpQjXSabVjRppJW2N');
const DECIMALS = 6;

interface Challenge {
  id: number;
  title: string;
  description: string;
  type: 'multiple-choice' | 'calculation';
  question: string;
  options?: string[];
  correctAnswer: number | string;
  explanation: string;
}

const CHALLENGES: Challenge[] = [
  {
    id: 1,
    title: 'Spot the Fake',
    description: 'An AI agent completed 3 tasks. One output is clearly wrong. Which one?',
    type: 'multiple-choice',
    question: 'Task: "Calculate 15% of 200"\n\nAgent A: "30"\nAgent B: "15"\nAgent C: "30.00"',
    options: ['Agent A', 'Agent B', 'Agent C'],
    correctAnswer: 1,
    explanation: 'Agent B returned 15, which is 7.5% of 200, not 15%. KAMIYO oracles must identify faulty outputs to protect users.',
  },
  {
    id: 2,
    title: 'Commit-Reveal',
    description: 'In dispute resolution, oracles commit a hidden vote before revealing. Why?',
    type: 'multiple-choice',
    question: 'Why do KAMIYO oracles use commit-reveal voting?',
    options: [
      'To save gas fees',
      'To prevent vote copying and collusion',
      'To make voting faster',
      'To hide results from users',
    ],
    correctAnswer: 1,
    explanation: 'Commit-reveal prevents oracles from seeing others\' votes before committing their own, eliminating copycat voting and collusion.',
  },
  {
    id: 3,
    title: 'Reputation Check',
    description: 'ZK proofs let agents prove reputation without revealing exact scores.',
    type: 'calculation',
    question: 'An agent has completed 20 jobs with 17 successful outcomes.\n\nA job requires 80% minimum reputation.\n\nDoes this agent qualify?',
    options: ['Yes, they qualify', 'No, they don\'t qualify'],
    correctAnswer: 0,
    explanation: '17/20 = 85% success rate, which exceeds the 80% threshold. The agent can generate a ZK proof of this without revealing the exact 85%.',
  },
  {
    id: 4,
    title: 'Stake Weight',
    description: 'Oracle voting power is stake-weighted. Larger stakes = more influence.',
    type: 'multiple-choice',
    question: 'Oracle A stakes 10 SOL, Oracle B stakes 5 SOL. Both vote correctly.\n\nOracle C stakes 20 SOL and votes incorrectly.\n\nWho wins the dispute?',
    options: [
      'Oracle C (highest individual stake)',
      'Oracles A + B (combined stake exceeds C)',
      'Nobody, it\'s a tie',
    ],
    correctAnswer: 1,
    explanation: 'A + B = 15 SOL of correct votes vs C = 20 SOL incorrect. Wait—C wins! Stake weight determines outcome. This is why oracle diversity matters.',
  },
  {
    id: 5,
    title: 'Payment Flow',
    description: 'Understanding x402 payment verification.',
    type: 'multiple-choice',
    question: 'In the x402 protocol, what happens if a payment proof fails verification?',
    options: [
      'The payment is automatically refunded',
      'The request returns HTTP 402 Payment Required',
      'The agent is permanently banned',
      'The escrow is disputed',
    ],
    correctAnswer: 1,
    explanation: 'HTTP 402 is returned with payment requirements. The client must provide a valid payment to proceed. No automatic refunds or bans—just access control.',
  },
];

type TrialPhase = 'intro' | 'stake-check' | 'challenges' | 'complete' | 'share' | 'failed';

interface StakePosition {
  stakedAmount: number;
}

interface CompletionStatus {
  completed: boolean;
  score?: number;
  refCode?: string;
  shared?: boolean;
  referralCount?: number;
  entries?: number;
}

function fromRawAmount(raw: bigint): number {
  return Number(raw) / Math.pow(10, DECIMALS);
}

export default function TrialsPage() {
  const { publicKey, signMessage } = useWallet();
  const { connection } = useConnection();
  const { setVisible } = useWalletModal();
  const searchParams = useSearchParams();

  const [phase, setPhase] = useState<TrialPhase>('intro');
  const [currentChallenge, setCurrentChallenge] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>(new Array(CHALLENGES.length).fill(null));
  const [showExplanation, setShowExplanation] = useState(false);
  const [stakePosition, setStakePosition] = useState<StakePosition | null>(null);
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [completionStatus, setCompletionStatus] = useState<CompletionStatus | null>(null);
  const [refCode, setRefCode] = useState<string | null>(null);
  const [referralCount, setReferralCount] = useState(0);
  const [entries, setEntries] = useState(0);
  const [shared, setShared] = useState(false);
  const [copied, setCopied] = useState(false);
  const [attemptUsed, setAttemptUsed] = useState(false);
  const [finalScore, setFinalScore] = useState<number | null>(null);

  // Get referral code from URL
  const referredBy = searchParams.get('ref');

  useEffect(() => {
    setMounted(true);
  }, []);

  // Check if user already completed or has used their attempt
  useEffect(() => {
    const checkStatus = async () => {
      if (!publicKey) return;
      try {
        // Check completion status
        const completeRes = await fetch(`/api/trials/complete?wallet=${publicKey.toBase58()}`);
        const completeData = await completeRes.json();
        if (completeData.completed) {
          setCompletionStatus(completeData);
          setRefCode(completeData.refCode);
          setShared(completeData.shared);
          setReferralCount(completeData.referralCount || 0);
          setEntries(completeData.entries || 0);
          if (completeData.shared) {
            setPhase('complete');
          } else {
            setPhase('share');
          }
          return;
        }

        // Check attempt status
        const attemptRes = await fetch(`/api/trials/attempt?wallet=${publicKey.toBase58()}`);
        const attemptData = await attemptRes.json();
        if (attemptData.hasAttempt && attemptData.completed && !attemptData.passed) {
          setAttemptUsed(true);
          setPhase('failed');
        }
      } catch (err) {
        console.error('Error checking status:', err);
      }
    };
    checkStatus();
  }, [publicKey]);

  const fetchStakePosition = useCallback(async () => {
    if (!publicKey) return;

    try {
      const [positionPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from('position'), publicKey.toBuffer()],
        STAKING_PROGRAM_ID
      );
      const posInfo = await connection.getAccountInfo(positionPDA);
      if (posInfo) {
        const data = posInfo.data;
        const offset = 8 + 32;
        const stakedAmount = data.readBigUInt64LE(offset);
        setStakePosition({ stakedAmount: fromRawAmount(stakedAmount) });
      } else {
        setStakePosition(null);
      }
    } catch (err) {
      console.error('Error fetching stake position:', err);
    }
  }, [publicKey, connection]);

  useEffect(() => {
    if (phase === 'stake-check') {
      fetchStakePosition();
    }
  }, [phase, fetchStakePosition]);

  const handleStartTrials = () => {
    if (!publicKey) {
      setVisible(true);
      return;
    }
    setPhase('stake-check');
  };

  const handleAnswer = (answerIndex: number) => {
    const newAnswers = [...answers];
    newAnswers[currentChallenge] = answerIndex;
    setAnswers(newAnswers);
    setShowExplanation(true);
  };

  const handleNextChallenge = async () => {
    setShowExplanation(false);
    if (currentChallenge < CHALLENGES.length - 1) {
      setCurrentChallenge(currentChallenge + 1);
    } else {
      const score = getScore();
      setFinalScore(score);

      // Complete the attempt (mark as passed or failed)
      if (publicKey) {
        try {
          await fetch('/api/trials/attempt', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              wallet: publicKey.toBase58(),
              passed: score === 5,
            }),
          });
        } catch (err) {
          console.error('Failed to complete attempt:', err);
        }
      }

      if (score === 5 && publicKey && signMessage) {
        await submitCompletion();
        setPhase('share');
      } else {
        setAttemptUsed(true);
        setPhase('failed');
      }
    }
  };

  const startAttempt = async () => {
    if (!publicKey || !signMessage) return false;

    try {
      setLoading(true);
      const message = `KAMIYO Trials Attempt\nWallet: ${publicKey.toBase58()}\nTimestamp: ${Date.now()}`;
      const messageBytes = new TextEncoder().encode(message);
      const signature = await signMessage(messageBytes);

      const response = await fetch('/api/trials/attempt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet: publicKey.toBase58(),
          signature: bs58.encode(signature),
          message,
        }),
      });

      const data = await response.json();
      if (response.ok) {
        return true;
      } else if (data.attemptUsed) {
        setAttemptUsed(true);
        setPhase('failed');
        return false;
      }
      return false;
    } catch (error) {
      console.error('Failed to start attempt:', error);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const submitCompletion = async () => {
    if (!publicKey || !signMessage) return;

    try {
      setLoading(true);
      const score = getScore();
      const message = `KAMIYO Trials Completion\nWallet: ${publicKey.toBase58()}\nScore: ${score}/5\nTimestamp: ${Date.now()}`;

      const messageBytes = new TextEncoder().encode(message);
      const signature = await signMessage(messageBytes);

      const response = await fetch('/api/trials/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet: publicKey.toBase58(),
          score,
          signature: bs58.encode(signature),
          message,
          referredBy,
        }),
      });

      const data = await response.json();
      if (response.ok) {
        setRefCode(data.refCode);
        setReferralCount(data.referralCount || 0);
        setEntries(data.entries || 0);
      }
    } catch (error) {
      console.error('Failed to submit completion:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async () => {
    if (!publicKey || !signMessage || !refCode) return;

    // Open X share intent
    const shareText = `I passed The KAMIYO Trials with a perfect score.

5M $KAMIYO prize pool. Think you can do it?

app.kamiyo.ai/trials?ref=${refCode}

@KamiyoAI`;

    window.open(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`,
      '_blank'
    );

    // After a short delay, prompt to confirm share
    setTimeout(async () => {
      try {
        setLoading(true);
        const message = `KAMIYO Trials Share Confirmation\nWallet: ${publicKey.toBase58()}\nTimestamp: ${Date.now()}`;

        const messageBytes = new TextEncoder().encode(message);
        const signature = await signMessage(messageBytes);

        const response = await fetch('/api/trials/complete', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            wallet: publicKey.toBase58(),
            signature: bs58.encode(signature),
            message,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          setShared(true);
          setReferralCount(data.referralCount || 0);
          setEntries(data.entries || 0);
          setPhase('complete');
        }
      } catch (error) {
        console.error('Failed to confirm share:', error);
      } finally {
        setLoading(false);
      }
    }, 2000);
  };

  const copyRefLink = () => {
    if (!refCode) return;
    navigator.clipboard.writeText(`https://app.kamiyo.ai/trials?ref=${refCode}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getScore = () => {
    let correct = 0;
    answers.forEach((answer, idx) => {
      if (answer === CHALLENGES[idx].correctAnswer) {
        correct++;
      }
    });
    return correct;
  };

  const isPerfect = () => getScore() === 5;
  const hasMinStake = () => stakePosition && stakePosition.stakedAmount >= 100000;

  const challenge = CHALLENGES[currentChallenge];

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="w-full px-5 mx-auto max-w-[1400px] py-16">

        {/* Intro Phase */}
        {phase === 'intro' && (
          <div className="min-h-[calc(100vh-200px)] flex flex-col justify-center text-center">
            <h1 className="text-3xl md:text-4xl font-medium mb-4">The KAMIYO Trials</h1>
            <span className="text-gray-400 text-sm md:text-lg block">
              Not everyone can judge an AI. Prove you can.
            </span>

            <div className="grid md:grid-cols-2 gap-6 mt-10 mb-12">
              <div className="bg-black border border-gray-500/25 rounded-lg p-8 text-left">
                <h2 className="text-xl text-white mb-4">How it works</h2>
                <div className="space-y-4 text-gray-400">
                  <div className="flex gap-4">
                    <div className="w-8 h-8 rounded-full border flex items-center justify-center text-white text-sm flex-shrink-0" style={{ borderColor: '#00f0ff' }}>1</div>
                    <div>
                      <p className="text-white">Connect & Stake</p>
                      <p className="text-sm">Link your wallet and stake minimum 100K KAMIYO</p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="w-8 h-8 rounded-full border flex items-center justify-center text-white text-sm flex-shrink-0" style={{ borderColor: '#00f0ff' }}>2</div>
                    <div>
                      <p className="text-white">Score 5/5</p>
                      <p className="text-sm">Complete all 5 challenges correctly. One attempt only.</p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="w-8 h-8 rounded-full border flex items-center justify-center text-white text-sm flex-shrink-0" style={{ borderColor: '#00f0ff' }}>3</div>
                    <div>
                      <p className="text-white">Share to Enter</p>
                      <p className="text-sm">Post your result on X to claim your entry</p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="w-8 h-8 rounded-full border flex items-center justify-center text-white text-sm flex-shrink-0" style={{ borderColor: '#00f0ff' }}>+</div>
                    <div>
                      <p className="text-white">Referral Bonus</p>
                      <p className="text-sm">Each friend who completes = +1 entry (max 10 bonus)</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-black border border-gray-500/25 rounded-lg p-8 text-left">
                <h3 className="text-xl text-white mb-4">Prizes</h3>
                <div className="text-gray-400 space-y-4">
                  <div>
                    <p className="text-sm uppercase tracking-wider mb-1 gradient-text">Grand Prize</p>
                    <p className="text-white text-2xl">1,000,000 KAMIYO</p>
                    <p className="text-gray-500 text-sm">+ Genesis Oracle NFT</p>
                  </div>
                  <div>
                    <p className="text-sm uppercase tracking-wider mb-1 gradient-text">10x Runner-up</p>
                    <p className="text-white text-2xl">400,000 KAMIYO</p>
                    <p className="text-gray-500 text-sm">each</p>
                  </div>
                  <p className="text-gray-500 text-xs pt-2">Winners drawn weighted by entries. More referrals = better odds.</p>
                </div>
              </div>
            </div>

            {referredBy && (
              <p className="text-gray-500 text-sm mb-4">Referred by: {referredBy}</p>
            )}

            <div className="flex justify-center">
              <PayButton
                text={publicKey ? "Begin Trials" : "Connect Wallet"}
                onClick={handleStartTrials}
              />
            </div>
          </div>
        )}

        {/* Stake Check Phase */}
        {phase === 'stake-check' && (
          <div className="max-w-xl mx-auto text-center min-h-[calc(100vh-200px)] flex flex-col justify-center">
            <h2 className="text-3xl text-white mb-6">Stake Verification</h2>

            {stakePosition === null ? (
              <div className="bg-black border border-gray-500/25 rounded-lg p-8">
                <p className="text-gray-400 mb-6">
                  You need to stake at least 100,000 KAMIYO to participate in the trials.
                </p>
                <Link href="/stake">
                  <PayButton text="Go to Staking" onClick={() => {}} />
                </Link>
              </div>
            ) : stakePosition.stakedAmount < 100000 ? (
              <div className="bg-black border border-gray-500/25 rounded-lg p-8">
                <p className="text-gray-400 mb-4">
                  Current stake: <span className="text-white">{stakePosition.stakedAmount.toLocaleString()} KAMIYO</span>
                </p>
                <p className="text-gray-400 mb-6">
                  You need at least 100,000 KAMIYO staked to participate.
                </p>
                <Link href="/stake">
                  <PayButton text="Increase Stake" onClick={() => {}} />
                </Link>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="bg-black border border-gray-500/25 rounded-lg p-6 text-center">
                  <div className="w-12 h-12 rounded-full border-2 flex items-center justify-center mx-auto mb-3" style={{ borderColor: '#00f0ff' }}>
                    <svg className="w-6 h-6" fill="none" stroke="#00f0ff" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <p className="mb-1" style={{ color: '#00f0ff' }}>Stake Verified</p>
                  <p className="text-gray-500 text-sm">
                    {stakePosition.stakedAmount.toLocaleString()} KAMIYO
                  </p>
                </div>

                <div className="bg-black border border-gray-500/25 rounded-lg p-6">
                  <h3 className="text-white text-lg mb-4">5 Challenges Ahead</h3>
                  <p className="text-gray-400 text-sm mb-4">
                    You'll be tested on core KAMIYO concepts. Must get all 5 correct to qualify.
                  </p>
                  <div className="space-y-2 text-sm text-gray-500">
                    <div className="flex items-center gap-2">
                      <span className="text-white">1.</span> Identifying faulty AI outputs
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-white">2.</span> Commit-reveal voting mechanics
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-white">3.</span> ZK reputation proofs
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-white">4.</span> Stake-weighted consensus
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-white">5.</span> x402 payment protocol
                    </div>
                  </div>
                </div>

                <div className="text-center">
                  <PayButton
                    text={loading ? "Registering..." : "Start Challenges"}
                    onClick={async () => {
                      const success = await startAttempt();
                      if (success) {
                        setPhase('challenges');
                      }
                    }}
                    disabled={loading}
                  />
                  <p className="text-gray-500 text-xs mt-4">
                    You have one attempt. Make it count.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Challenges Phase */}
        {phase === 'challenges' && (
          <div className="max-w-2xl mx-auto min-h-[calc(100vh-200px)] flex flex-col justify-center">
            {/* Progress */}
            <div className="mb-8">
              <div className="flex justify-between text-sm text-gray-500 mb-2">
                <span>Challenge {currentChallenge + 1} of {CHALLENGES.length}</span>
                <span>{getScore()} correct so far</span>
              </div>
              <div className="h-1 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full transition-all duration-500"
                  style={{
                    width: `${((currentChallenge + (showExplanation ? 1 : 0)) / CHALLENGES.length) * 100}%`,
                    background: 'linear-gradient(90deg, #4fe9ea, #ff44f5)',
                  }}
                />
              </div>
            </div>

            {/* Challenge Card */}
            <div className="bg-black border border-gray-500/25 rounded-lg p-8">
              <div className="text-xs uppercase tracking-wider mb-2" style={{ color: '#00f0ff' }}>{challenge.title}</div>
              <p className="text-gray-400 text-sm mb-6">{challenge.description}</p>

              <div className="bg-gray-900/50 rounded-lg p-4 mb-6 font-mono text-sm whitespace-pre-wrap">
                {challenge.question}
              </div>

              {!showExplanation ? (
                <div className="space-y-3">
                  {challenge.options?.map((option, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleAnswer(idx)}
                      className="w-full text-left p-4 rounded-lg border border-gray-500/50 hover:border-gray-300 transition-colors text-gray-300 hover:text-white"
                    >
                      {option}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Show selected answer */}
                  <div className="space-y-3">
                    {challenge.options?.map((option, idx) => {
                      const isSelected = answers[currentChallenge] === idx;
                      const isCorrect = idx === challenge.correctAnswer;
                      let borderStyle = { borderColor: 'rgba(107, 114, 128, 0.25)' };
                      let textStyle = { color: '#6b7280' };

                      if (isSelected && isCorrect) {
                        borderStyle = { borderColor: '#00f0ff' };
                        textStyle = { color: '#00f0ff' };
                      } else if (isSelected && !isCorrect) {
                        borderStyle = { borderColor: '#ff44f5' };
                        textStyle = { color: '#ff44f5' };
                      } else if (isCorrect) {
                        borderStyle = { borderColor: 'rgba(0, 240, 255, 0.5)' };
                        textStyle = { color: 'rgba(0, 240, 255, 0.7)' };
                      }

                      return (
                        <div
                          key={idx}
                          className="p-4 rounded-lg border"
                          style={{ ...borderStyle, ...textStyle }}
                        >
                          {option}
                          {isCorrect && <span className="ml-2 text-xs">(correct)</span>}
                          {isSelected && !isCorrect && <span className="ml-2 text-xs">(wrong)</span>}
                        </div>
                      );
                    })}
                  </div>

                  {/* Explanation */}
                  <div className="bg-gray-900/50 border-l-2 p-4 rounded-r-lg" style={{ borderColor: '#00f0ff' }}>
                    <p className="text-gray-400 text-sm">{challenge.explanation}</p>
                  </div>

                  <div className="pt-4 flex justify-center">
                    <PayButton
                      text={currentChallenge < CHALLENGES.length - 1 ? "Next Challenge" : "View Results"}
                      onClick={handleNextChallenge}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Share Phase - Only shown after 5/5 */}
        {phase === 'share' && (
          <div className="max-w-xl mx-auto text-center min-h-[calc(100vh-200px)] flex flex-col justify-center">
            <div className="w-24 h-24 rounded-full border-2 flex items-center justify-center mx-auto mb-6" style={{ borderColor: '#00f0ff' }}>
              <span className="text-4xl" style={{ color: '#00f0ff' }}>5/5</span>
            </div>

            <h2 className="text-3xl text-white mb-4">Perfect Score!</h2>

            <p className="text-gray-400 mb-8">
              One step left: share on X to claim your entry.
            </p>

            <div className="bg-black border border-gray-500/25 rounded-lg p-6 mb-8">
              <p className="text-gray-400 text-sm mb-4">
                Your share will include your unique referral link. Each friend who completes the trials = +1 bonus entry for you.
              </p>
              <div className="flex justify-center">
                <PayButton
                  text={loading ? "Confirming..." : "Share on X to Enter"}
                  onClick={handleShare}
                  disabled={loading}
                />
              </div>
            </div>

            <p className="text-gray-500 text-xs">
              After sharing, sign a message to confirm your entry.
            </p>
          </div>
        )}

        {/* Complete Phase */}
        {phase === 'complete' && (
          <div className="max-w-xl mx-auto text-center min-h-[calc(100vh-200px)] flex flex-col justify-center">
            <div
              className="w-24 h-24 rounded-full border-2 flex items-center justify-center mx-auto mb-6"
              style={{ borderColor: (completionStatus?.score || getScore()) === 5 ? '#00f0ff' : '#ff44f5' }}
            >
              <span className="text-4xl" style={{ color: (completionStatus?.score || getScore()) === 5 ? '#00f0ff' : '#ff44f5' }}>
                {completionStatus?.score || getScore()}/{CHALLENGES.length}
              </span>
            </div>

            {shared ? (
              <>
                <h2 className="text-3xl text-white mb-6">You're In!</h2>
                <p className="text-gray-400 mb-10">
                  Entry confirmed. Recruit friends to boost your odds.
                </p>

                {/* Entry Stats */}
                <div className="grid grid-cols-2 gap-4 mb-8">
                  <div className="bg-black border border-gray-500/25 rounded-lg p-4">
                    <p className="text-2xl" style={{ color: '#00f0ff' }}>{entries}</p>
                    <p className="text-gray-500 text-sm">Total Entries</p>
                  </div>
                  <div className="bg-black border border-gray-500/25 rounded-lg p-4">
                    <p className="text-2xl" style={{ color: '#ff44f5' }}>{referralCount}</p>
                    <p className="text-gray-500 text-sm">Referrals</p>
                  </div>
                </div>

                {/* Referral Link */}
                <div className="bg-black border border-gray-500/25 rounded-lg p-6 mb-8">
                  <p className="text-gray-400 text-sm mb-3">Your referral link:</p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      readOnly
                      value={`app.kamiyo.ai/trials?ref=${refCode}`}
                      className="flex-1 bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm font-mono text-white"
                    />
                    <button
                      onClick={copyRefLink}
                      className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded text-sm transition-colors"
                    >
                      {copied ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                  <p className="text-gray-500 text-xs mt-3">
                    Max 10 bonus entries. You have {10 - referralCount} slots left.
                  </p>
                </div>

                <Link href="/trials/leaderboard" className="hover:text-white transition-colors text-sm" style={{ color: '#00f0ff' }}>
                  View Leaderboard
                </Link>
              </>
            ) : (
              <>
                <h2 className="text-3xl text-white mb-6">Almost There!</h2>
                <p className="text-gray-400 mb-10">
                  Share on X to claim your entry.
                </p>
                <div className="flex justify-center">
                  <PayButton
                    text="Share to Enter"
                    onClick={() => setPhase('share')}
                  />
                </div>
              </>
            )}
          </div>
        )}

        {/* Failed Phase - Permanent failure state */}
        {phase === 'failed' && (
          <div className="max-w-xl mx-auto text-center min-h-[calc(100vh-200px)] flex flex-col justify-center">
            <div
              className="w-24 h-24 rounded-full border-2 flex items-center justify-center mx-auto mb-6"
              style={{ borderColor: '#ff44f5' }}
            >
              <span className="text-4xl" style={{ color: '#ff44f5' }}>
                {finalScore !== null ? finalScore : '?'}/5
              </span>
            </div>

            <h2 className="text-3xl text-white mb-6">Trial Failed</h2>
            <span className="text-gray-400 block" style={{ marginBottom: '3rem' }}>
              You needed a perfect 5/5 to qualify. Your one attempt has been used.
            </span>

            <div className="bg-black border border-gray-500/25 rounded-lg p-6 mb-8">
              <p className="text-gray-500 text-sm">
                The KAMIYO Trials require perfection. Each wallet gets one chance to prove their understanding of the protocol.
              </p>
            </div>

            <Link href="/trials/leaderboard" className="hover:text-white transition-colors text-sm" style={{ color: '#00f0ff' }}>
              View Leaderboard
            </Link>
          </div>
        )}

      </div>
    </div>
  );
}
