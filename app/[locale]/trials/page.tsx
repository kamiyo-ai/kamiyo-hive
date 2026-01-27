'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { PublicKey } from '@solana/web3.js';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import PayButton from '@/components/PayButton';
import CountdownTimer from '@/components/CountdownTimer';
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

function TrialsContent() {
  const t = useTranslations('trials');
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
              score,
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

    try {
      setLoading(true);

      // Sign the confirmation message FIRST, before opening Twitter
      const message = `KAMIYO Trials Share Confirmation\nWallet: ${publicKey.toBase58()}\nTimestamp: ${Date.now()}`;
      const messageBytes = new TextEncoder().encode(message);
      const signature = await signMessage(messageBytes);

      // Confirm share on backend
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

        // Build share URL
        const shareText = `I passed The KAMIYO Trials with a perfect score.

5M $KAMIYO prize pool. Think you can do it?

app.kamiyo.ai/trials?ref=${refCode}

@KamiyoAI`;

        const shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`;

        // Try to open Twitter share - use location.href as fallback for in-app browsers
        const newWindow = window.open(shareUrl, '_blank');
        if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
          // Popup blocked or in-app browser - use direct navigation
          window.location.href = shareUrl;
        }

        // Move to complete phase after a short delay to ensure state updates
        setTimeout(() => {
          setPhase('complete');
        }, 100);
      }
    } catch (error) {
      console.error('Failed to confirm share:', error);
    } finally {
      setLoading(false);
    }
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
    <div className="bg-black text-white">
      <div className="w-full px-5 mx-auto max-w-[1400px] pt-24 md:pt-28 pb-8 md:pb-16">

        {/* Intro Phase */}
        {phase === 'intro' && (
          <div className="min-h-[calc(100vh-200px)] flex flex-col justify-center text-center">
            <p className="font-light text-sm uppercase tracking-widest gradient-text mb-4">
              — Trials トライアル
            </p>
            <h1 className="text-3xl md:text-4xl font-medium mb-4">{t('title')}</h1>
            <span className="text-gray-400 text-sm md:text-lg block mb-8">
              {t('subtitle')}
            </span>

            <CountdownTimer />

            <div className="grid md:grid-cols-2 gap-4 md:gap-6 mt-8 md:mt-10 mb-8 md:mb-12">
              <div className="bg-black border border-gray-500/25 rounded-lg p-5 md:p-8 text-left">
                <h2 className="text-xl text-white mb-4">{t('howItWorks')}</h2>
                <div className="space-y-4 text-gray-400">
                  <div className="flex gap-4">
                    <div className="w-8 h-8 rounded-full border flex items-center justify-center text-white text-sm flex-shrink-0" style={{ borderColor: '#00f0ff' }}>1</div>
                    <div>
                      <p className="text-white">{t('steps.connectStake.title')}</p>
                      <p className="text-sm">{t('steps.connectStake.description')}</p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="w-8 h-8 rounded-full border flex items-center justify-center text-white text-sm flex-shrink-0" style={{ borderColor: '#00f0ff' }}>2</div>
                    <div>
                      <p className="text-white">{t('steps.score.title')}</p>
                      <p className="text-sm">{t('steps.score.description')}</p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="w-8 h-8 rounded-full border flex items-center justify-center text-white text-sm flex-shrink-0" style={{ borderColor: '#00f0ff' }}>3</div>
                    <div>
                      <p className="text-white">{t('steps.share.title')}</p>
                      <p className="text-sm">{t('steps.share.description')}</p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="w-8 h-8 rounded-full border flex items-center justify-center text-white text-sm flex-shrink-0" style={{ borderColor: '#00f0ff' }}>+</div>
                    <div>
                      <p className="text-white">{t('steps.referral.title')}</p>
                      <p className="text-sm">{t('steps.referral.description')}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-black border border-gray-500/25 rounded-lg p-5 md:p-8 text-left">
                <h3 className="text-xl text-white mb-4">{t('prizes')}</h3>
                <div className="text-gray-400 space-y-4">
                  <div>
                    <p className="text-sm uppercase tracking-wider mb-1 gradient-text">{t('grandPrize.label')}</p>
                    <p className="text-white text-2xl">{t('grandPrize.amount')}</p>
                    <p className="text-gray-500 text-sm">{t('grandPrize.bonus')}</p>
                  </div>
                  <div>
                    <p className="text-sm uppercase tracking-wider mb-1 gradient-text">{t('runnerUp.label')}</p>
                    <p className="text-white text-2xl">{t('runnerUp.amount')}</p>
                    <p className="text-gray-500 text-sm">{t('runnerUp.bonus')}</p>
                  </div>
                  <p className="text-gray-500 text-xs pt-2">{t('prizeNote')}</p>
                </div>
              </div>
            </div>

            {referredBy && (
              <p className="text-gray-500 text-sm mb-4">{t('referredBy')} {referredBy}</p>
            )}

            <div className="flex flex-col items-center gap-4">
              <PayButton
                text={publicKey ? t('beginTrials') : t('connectWallet')}
                onClick={handleStartTrials}
              />
              <Link href="/trials/leaderboard" className="text-sm text-gray-500 hover:text-gray-300 transition-colors">
                {t('viewLeaderboard')}
              </Link>
            </div>
          </div>
        )}

        {/* Stake Check Phase */}
        {phase === 'stake-check' && (
          <div className="max-w-xl mx-auto text-center min-h-[calc(100vh-200px)] flex flex-col justify-center">
            <h2 className="text-3xl text-white mb-6">{t('stakeVerification.title')}</h2>

            {stakePosition === null ? (
              <div className="bg-black border border-gray-500/25 rounded-lg p-8">
                <p className="text-gray-400 mb-6">
                  {t('stakeVerification.noStake')}
                </p>
                <Link href="/stake">
                  <PayButton text={t('stakeVerification.goToStaking')} onClick={() => {}} />
                </Link>
              </div>
            ) : stakePosition.stakedAmount < 100000 ? (
              <div className="bg-black border border-gray-500/25 rounded-lg p-8">
                <p className="text-gray-400 mb-4">
                  {t('stakeVerification.currentStake')} <span className="text-white">{stakePosition.stakedAmount.toLocaleString()} KAMIYO</span>
                </p>
                <p className="text-gray-400 mb-6">
                  {t('stakeVerification.needMore')}
                </p>
                <Link href="/stake">
                  <PayButton text={t('stakeVerification.increaseStake')} onClick={() => {}} />
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
                  <p className="mb-1" style={{ color: '#00f0ff' }}>{t('stakeVerification.verified')}</p>
                  <p className="text-gray-500 text-sm">
                    {stakePosition.stakedAmount.toLocaleString()} KAMIYO
                  </p>
                </div>

                <div className="bg-black border border-gray-500/25 rounded-lg p-6">
                  <h3 className="text-white text-lg mb-4">{t('challengesAhead.title')}</h3>
                  <p className="text-gray-400 text-sm mb-4">
                    {t('challengesAhead.description')}
                  </p>
                  <div className="space-y-2 text-sm text-gray-500">
                    <div className="flex items-center gap-2">
                      <span className="text-white">1.</span> {t('challengesAhead.topics.1')}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-white">2.</span> {t('challengesAhead.topics.2')}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-white">3.</span> {t('challengesAhead.topics.3')}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-white">4.</span> {t('challengesAhead.topics.4')}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-white">5.</span> {t('challengesAhead.topics.5')}
                    </div>
                  </div>
                </div>

                <div className="text-center">
                  <PayButton
                    text={loading ? t('registering') : t('startChallenges')}
                    onClick={async () => {
                      const success = await startAttempt();
                      if (success) {
                        setPhase('challenges');
                      }
                    }}
                    disabled={loading}
                  />
                  <p className="text-gray-500 text-xs mt-4">
                    {t('oneAttempt')}
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
                <span>{t('progress.challenge', { current: currentChallenge + 1, total: CHALLENGES.length })}</span>
                <span>{t('progress.correctSoFar', { count: getScore() })}</span>
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
            <div className="bg-black border border-gray-500/25 rounded-lg p-5 md:p-8">
              <div className="text-xs uppercase tracking-wider mb-2" style={{ color: '#00f0ff' }}>{t(`challenges.${challenge.id}.title`)}</div>
              <p className="text-gray-400 text-sm mb-6">{t(`challenges.${challenge.id}.description`)}</p>

              <div className="bg-gray-900/50 rounded-lg p-4 mb-6 font-mono text-sm whitespace-pre-wrap">
                {t(`challenges.${challenge.id}.question`)}
              </div>

              {!showExplanation ? (
                <div className="space-y-3">
                  {challenge.options?.map((option, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleAnswer(idx)}
                      className="w-full text-left p-4 rounded-lg border border-gray-500/50 hover:border-gray-300 transition-colors text-gray-300 hover:text-white"
                    >
                      {t(`challenges.${challenge.id}.options.${idx}`)}
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
                          {t(`challenges.${challenge.id}.options.${idx}`)}
                          {isCorrect && <span className="ml-2 text-xs">({t('correct')})</span>}
                          {isSelected && !isCorrect && <span className="ml-2 text-xs">({t('wrong')})</span>}
                        </div>
                      );
                    })}
                  </div>

                  {/* Explanation */}
                  <div className="bg-gray-900/50 border-l-2 p-4 rounded-r-lg" style={{ borderColor: '#00f0ff' }}>
                    <p className="text-gray-400 text-sm">{t(`challenges.${challenge.id}.explanation`)}</p>
                  </div>

                  <div className="pt-4 flex justify-center">
                    <PayButton
                      text={currentChallenge < CHALLENGES.length - 1 ? t('nextChallenge') : t('viewResults')}
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

            <h2 className="text-3xl text-white mb-4">{t('perfectScore.title')}</h2>

            <p className="text-gray-400 mb-8">
              {t('perfectScore.description')}
            </p>

            <div className="bg-black border border-gray-500/25 rounded-lg p-6 mb-8">
              <p className="text-gray-400 text-sm mb-4">
                {t('perfectScore.shareInfo')}
              </p>
              <div className="flex justify-center">
                <PayButton
                  text={loading ? t('perfectScore.confirming') : t('perfectScore.shareToEnter')}
                  onClick={handleShare}
                  disabled={loading}
                />
              </div>
            </div>

            <p className="text-gray-500 text-xs">
              {t('perfectScore.afterShare')}
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
                <h2 className="text-3xl text-white mb-6">{t('complete.youreIn')}</h2>
                <p className="text-gray-400 mb-10">
                  {t('complete.entryConfirmed')}
                </p>

                {/* Entry Stats */}
                <div className="grid grid-cols-2 gap-4 mb-8">
                  <div className="bg-black border border-gray-500/25 rounded-lg p-4">
                    <p className="text-2xl" style={{ color: '#00f0ff' }}>{entries}</p>
                    <p className="text-gray-500 text-sm">{t('complete.totalEntries')}</p>
                  </div>
                  <div className="bg-black border border-gray-500/25 rounded-lg p-4">
                    <p className="text-2xl" style={{ color: '#ff44f5' }}>{referralCount}</p>
                    <p className="text-gray-500 text-sm">{t('complete.referrals')}</p>
                  </div>
                </div>

                {/* Referral Link */}
                <div className="bg-black border border-gray-500/25 rounded-lg p-6 mb-8">
                  <p className="text-gray-400 text-sm mb-3">{t('complete.referralLink')}</p>
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
                      {copied ? t('complete.copied') : t('complete.copy')}
                    </button>
                  </div>
                  <p className="text-gray-500 text-xs mt-3">
                    {t('complete.slotsLeft', { slots: 10 - referralCount })}
                  </p>
                </div>

                <Link href="/trials/leaderboard" className="hover:text-white transition-colors text-sm inline-flex items-center gap-1" style={{ color: '#ff44f5' }}>
                  {t('viewLeaderboard')} <span>&rarr;</span>
                </Link>
              </>
            ) : (
              <>
                <h2 className="text-3xl text-white mb-6">{t('complete.almostThere')}</h2>
                <p className="text-gray-400 mb-10">
                  {t('complete.sharePrompt')}
                </p>
                <div className="flex justify-center">
                  <PayButton
                    text={t('complete.shareToEnter')}
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
              <span className="text-4xl gradient-text">
                {finalScore !== null ? finalScore : '?'}/5
              </span>
            </div>

            <h2 className="text-3xl text-white mb-6">{t('failed.title')}</h2>
            <span className="text-gray-400 block" style={{ marginBottom: '3rem' }}>
              {t('failed.description')}
            </span>

            <div className="bg-black border border-gray-500/25 rounded-lg p-6 mb-8">
              <p className="text-gray-500 text-sm">
                {t('failed.explanation')}
              </p>
            </div>

            <Link href="/trials/leaderboard" className="hover:text-white transition-colors text-sm inline-flex items-center gap-1" style={{ color: '#ff44f5' }}>
              {t('viewLeaderboard')} <span>&rarr;</span>
            </Link>
          </div>
        )}

      </div>
    </div>
  );
}

export default function TrialsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black" />}>
      <TrialsContent />
    </Suspense>
  );
}
