'use client';

import { useState, useEffect, useCallback } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { PublicKey } from '@solana/web3.js';
import PayButton from '@/components/PayButton';
import Link from 'next/link';
import bs58 from 'bs58';

const STAKING_PROGRAM_ID = new PublicKey('9QZGdEZ13j8fASEuhpj3eVwUPT4BpQjXSabVjRppJW2N');
const KAMIYO_MINT = new PublicKey('Gy55EJmheLyDXiZ7k7CW2FhunD1UgjQxQibuBn3Npump');
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

type TrialPhase = 'intro' | 'stake-check' | 'challenges' | 'complete';

interface StakePosition {
  stakedAmount: number;
}

function fromRawAmount(raw: bigint): number {
  return Number(raw) / Math.pow(10, DECIMALS);
}

export default function TrialsPage() {
  const { publicKey, signMessage } = useWallet();
  const { connection } = useConnection();
  const { setVisible } = useWalletModal();

  const [phase, setPhase] = useState<TrialPhase>('intro');
  const [currentChallenge, setCurrentChallenge] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>(new Array(CHALLENGES.length).fill(null));
  const [showExplanation, setShowExplanation] = useState(false);
  const [stakePosition, setStakePosition] = useState<StakePosition | null>(null);
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

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
      setPhase('complete');
      // Submit completion if eligible
      if (getScore() >= 3 && publicKey && signMessage) {
        await submitCompletion();
      }
    }
  };

  const submitCompletion = async () => {
    if (!publicKey || !signMessage || submitted) return;

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
        }),
      });

      if (response.ok) {
        setSubmitted(true);
      }
    } catch (error) {
      console.error('Failed to submit completion:', error);
    } finally {
      setLoading(false);
    }
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

  const isEligible = () => {
    return getScore() >= 3 && stakePosition && stakePosition.stakedAmount >= 100000;
  };

  const challenge = CHALLENGES[currentChallenge];

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="w-full px-5 mx-auto max-w-[1400px] py-16">

        {/* Intro Phase */}
        {phase === 'intro' && (
          <div className="max-w-2xl mx-auto text-center">
            <h1 className="text-4xl md:text-5xl text-white mb-6">The KAMIYO Trials</h1>
            <p className="text-gray-400 text-lg mb-8">
              Not everyone can judge an AI. Prove you can.
            </p>

            <div className="bg-black border border-gray-500/25 rounded-lg p-8 mb-8 text-left">
              <h2 className="text-xl text-white mb-4">How it works</h2>
              <div className="space-y-4 text-gray-400">
                <div className="flex gap-4">
                  <div className="w-8 h-8 rounded-full border border-cyan flex items-center justify-center text-cyan text-sm flex-shrink-0">1</div>
                  <div>
                    <p className="text-white">Connect & Stake</p>
                    <p className="text-sm">Link your wallet and stake minimum 100K KAMIYO</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="w-8 h-8 rounded-full border border-cyan flex items-center justify-center text-cyan text-sm flex-shrink-0">2</div>
                  <div>
                    <p className="text-white">Complete 5 Challenges</p>
                    <p className="text-sm">Oracle-themed puzzles testing dispute resolution intuition</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="w-8 h-8 rounded-full border border-cyan flex items-center justify-center text-cyan text-sm flex-shrink-0">3</div>
                  <div>
                    <p className="text-white">Claim Entry</p>
                    <p className="text-sm">Score 3/5 or higher to enter the giveaway</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-black border border-magenta/25 rounded-lg p-6 mb-8">
              <h3 className="text-lg text-white mb-2">Prizes</h3>
              <div className="text-gray-400 text-sm space-y-1">
                <p><span className="text-magenta">Grand Prize:</span> 10,000 KAMIYO + Genesis Oracle NFT</p>
                <p><span className="text-cyan">10x Runner-up:</span> 2,500 KAMIYO each</p>
                <p><span className="text-gray-500">All Qualifiers:</span> Trial Survivor badge</p>
              </div>
            </div>

            <PayButton
              text={publicKey ? "Begin Trials" : "Connect Wallet"}
              onClick={handleStartTrials}
            />
          </div>
        )}

        {/* Stake Check Phase */}
        {phase === 'stake-check' && (
          <div className="max-w-xl mx-auto text-center">
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
              <div className="bg-black border border-cyan/25 rounded-lg p-8">
                <div className="w-16 h-16 rounded-full border-2 border-cyan flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="text-white text-lg mb-2">Stake Verified</p>
                <p className="text-gray-400 mb-6">
                  {stakePosition.stakedAmount.toLocaleString()} KAMIYO staked
                </p>
                <PayButton
                  text="Start Challenges"
                  onClick={() => setPhase('challenges')}
                />
              </div>
            )}
          </div>
        )}

        {/* Challenges Phase */}
        {phase === 'challenges' && (
          <div className="max-w-2xl mx-auto">
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
              <div className="text-cyan text-xs uppercase tracking-wider mb-2">{challenge.title}</div>
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
                      className="w-full text-left p-4 rounded-lg border border-gray-500/50 hover:border-cyan transition-colors text-gray-300 hover:text-white"
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
                      let borderColor = 'border-gray-500/25';
                      let textColor = 'text-gray-500';

                      if (isSelected && isCorrect) {
                        borderColor = 'border-green-500';
                        textColor = 'text-green-400';
                      } else if (isSelected && !isCorrect) {
                        borderColor = 'border-red-500';
                        textColor = 'text-red-400';
                      } else if (isCorrect) {
                        borderColor = 'border-green-500/50';
                        textColor = 'text-green-400/70';
                      }

                      return (
                        <div
                          key={idx}
                          className={`p-4 rounded-lg border ${borderColor} ${textColor}`}
                        >
                          {option}
                          {isCorrect && <span className="ml-2 text-xs">(correct)</span>}
                        </div>
                      );
                    })}
                  </div>

                  {/* Explanation */}
                  <div className="bg-gray-900/50 border-l-2 border-cyan p-4 rounded-r-lg">
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

        {/* Complete Phase */}
        {phase === 'complete' && (
          <div className="max-w-xl mx-auto text-center">
            <div className={`w-24 h-24 rounded-full border-2 flex items-center justify-center mx-auto mb-6 ${
              isEligible() ? 'border-cyan' : 'border-gray-500'
            }`}>
              <span className={`text-4xl ${isEligible() ? 'text-cyan' : 'text-gray-500'}`}>
                {getScore()}/{CHALLENGES.length}
              </span>
            </div>

            <h2 className="text-3xl text-white mb-4">
              {isEligible() ? 'You Passed!' : 'Trial Complete'}
            </h2>

            <p className="text-gray-400 mb-8">
              {isEligible()
                ? 'You\'ve proven your oracle intuition. You\'re entered in the giveaway.'
                : 'You need at least 3 correct answers to qualify. Try again!'}
            </p>

            {isEligible() ? (
              <div className="bg-black border border-cyan/25 rounded-lg p-6 mb-8">
                <p className="text-cyan text-sm mb-2">Entry Confirmed</p>
                <p className="text-white font-mono text-xs">
                  {publicKey?.toBase58()}
                </p>
              </div>
            ) : (
              <PayButton
                text="Try Again"
                onClick={() => {
                  setPhase('challenges');
                  setCurrentChallenge(0);
                  setAnswers(new Array(CHALLENGES.length).fill(null));
                  setShowExplanation(false);
                }}
              />
            )}

            <div className="mt-8 pt-8 border-t border-gray-800">
              <p className="text-gray-500 text-sm mb-4">Share your result</p>
              <a
                href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(
                  `I scored ${getScore()}/${CHALLENGES.length} on The KAMIYO Trials. ${isEligible() ? 'Qualified for the giveaway!' : 'The oracles judge harshly.'}\n\nTry it: app.kamiyo.ai/trials\n\n@KamiyoAI`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
                Share on X
              </a>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
