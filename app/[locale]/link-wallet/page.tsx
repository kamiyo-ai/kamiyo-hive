'use client';

import { useState, useEffect } from 'react';
import { useSession, signIn, signOut } from 'next-auth/react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import PayButton from '@/components/PayButton';
import bs58 from 'bs58';

export default function LinkWalletPage() {
  const { data: session, status: sessionStatus } = useSession();
  const { publicKey, signMessage, disconnect } = useWallet();
  const { setVisible } = useWalletModal();

  const [step, setStep] = useState<'twitter' | 'wallet' | 'sign' | 'done'>('twitter');
  const [challenge, setChallenge] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // Update step based on auth state
  useEffect(() => {
    if (sessionStatus === 'loading') return;

    if (!session) {
      setStep('twitter');
    } else if (!publicKey) {
      setStep('wallet');
    } else if (step !== 'sign' && step !== 'done') {
      setStep('sign');
      generateChallenge();
    }
  }, [session, sessionStatus, publicKey, step]);

  function generateChallenge() {
    if (!publicKey || !session?.user?.twitterId) return;

    const timestamp = Date.now();
    const nonce = Math.random().toString(36).substring(2, 10);
    const message = `KAMIYO Wallet Verification\n\nTwitter: @${session.user.twitterUsername}\nTwitter ID: ${session.user.twitterId}\nWallet: ${publicKey.toBase58()}\nTimestamp: ${timestamp}\nNonce: ${nonce}\n\nSign this message to link your wallet to your X account.`;
    setChallenge(message);
  }

  async function handleSign() {
    if (!publicKey || !signMessage || !challenge || !session?.user?.twitterId) return;

    setLoading(true);
    setError(null);

    try {
      const messageBytes = new TextEncoder().encode(challenge);
      const signatureBytes = await signMessage(messageBytes);
      const signatureBase58 = bs58.encode(signatureBytes);

      // Submit to API
      const response = await fetch('/api/link-wallet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: publicKey.toBase58(),
          signature: signatureBase58,
          message: challenge,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to link wallet');
      }

      setSuccess(true);
      setStep('done');
    } catch (err: unknown) {
      console.error('Linking error:', err);
      const message = err instanceof Error ? err.message : 'Failed to link wallet';
      if (message.includes('User rejected')) {
        setError('Signature request was rejected. Please try again.');
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    disconnect();
    signOut({ redirect: false });
    setStep('twitter');
    setChallenge(null);
    setError(null);
    setSuccess(false);
  }

  const stepNumber = step === 'twitter' ? 1 : step === 'wallet' ? 2 : step === 'sign' ? 3 : 4;

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="w-full px-5 mx-auto max-w-[800px] pt-24 md:pt-28 pb-8 md:pb-16">
        <div className="mb-8 md:mb-12">
          <h1 className="text-3xl md:text-4xl text-white mb-4">Link Wallet</h1>
          <p className="text-gray-400">
            Link your Solana wallet to your X account to access holder features like image generation.
          </p>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center mb-8 md:mb-12">
          <div className="flex items-center gap-2 sm:gap-4">
            {[1, 2, 3, 4].map((num) => (
              <div key={num} className="flex items-center gap-2 sm:gap-4">
                <div
                  className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs sm:text-sm font-medium
                    ${stepNumber === num
                      ? 'bg-black border border-transparent text-white'
                      : stepNumber > num
                        ? 'bg-gray-800 text-cyan'
                        : 'bg-gray-800 text-gray-400'
                    }`}
                  style={stepNumber === num ? {
                    background: 'linear-gradient(black, black) padding-box, linear-gradient(to right, #00ffff, #00ffff) border-box',
                  } : undefined}
                >
                  {num}
                </div>
                {num < 4 && (
                  <div className={`w-6 sm:w-12 h-0.5 ${stepNumber > num ? 'bg-gradient-to-r from-cyan to-magenta' : 'bg-gray-800'}`} />
                )}
              </div>
            ))}
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/25 rounded-lg">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        <div className="card relative p-5 md:p-8 rounded-xl border border-transparent" style={{ background: 'linear-gradient(black, black) padding-box, linear-gradient(to right, #00ffff, #ff00ff) border-box', borderWidth: '1px' }}>
          {/* Step 1: Sign in with X */}
          {step === 'twitter' && (
            <div className="text-center">
              <h2 className="text-xl text-white mb-4">Sign in with X</h2>
              <p className="text-gray-400 mb-8">
                Connect your X account to link it with your wallet.
              </p>
              {sessionStatus === 'loading' ? (
                <p className="text-gray-500">Loading...</p>
              ) : (
                <PayButton
                  text="Sign in with X"
                  onClick={() => signIn('twitter')}
                />
              )}
            </div>
          )}

          {/* Step 2: Connect Wallet */}
          {step === 'wallet' && session && (
            <div className="text-center">
              <h2 className="text-xl text-white mb-4">Connect Your Wallet</h2>
              <p className="text-gray-400 mb-4">
                Signed in as <span className="text-cyan">@{session.user?.twitterUsername}</span>
              </p>
              <p className="text-gray-400 mb-8">
                Now connect the wallet that holds your $KAMIYO tokens.
              </p>
              <PayButton
                text="Connect Wallet"
                onClick={() => setVisible(true)}
              />
            </div>
          )}

          {/* Step 3: Sign Message */}
          {step === 'sign' && publicKey && session && (
            <div>
              <h2 className="text-xl text-white mb-4">Sign Verification Message</h2>
              <p className="text-gray-400 mb-6">
                Sign this message to prove you own this wallet. This does not cost any gas.
              </p>

              <div className="mb-4">
                <span className="text-gray-400 text-xs uppercase tracking-wider">X Account</span>
                <div className="bg-black border border-gray-500/50 rounded px-4 py-3 font-mono text-sm text-cyan mt-2">
                  @{session.user?.twitterUsername}
                </div>
              </div>

              <div className="mb-4">
                <span className="text-gray-400 text-xs uppercase tracking-wider">Wallet</span>
                <div className="bg-black border border-gray-500/50 rounded px-4 py-3 font-mono text-sm text-cyan break-all mt-2">
                  {publicKey.toBase58()}
                </div>
              </div>

              <div className="mb-6">
                <span className="text-gray-400 text-xs uppercase tracking-wider">Message to Sign</span>
                <div className="bg-black border border-gray-500/50 rounded px-4 py-3 font-mono text-xs text-gray-300 whitespace-pre-wrap mt-2">
                  {challenge}
                </div>
              </div>

              <button
                onClick={reset}
                className="text-sm text-magenta hover:text-white transition-colors mb-6 flex items-center gap-2"
              >
                <span>←</span> Start over
              </button>

              <div className="flex justify-center">
                <PayButton
                  text={loading ? 'Linking...' : 'Sign & Link'}
                  disabled={loading}
                  onClick={handleSign}
                />
              </div>
            </div>
          )}

          {/* Step 4: Done */}
          {step === 'done' && success && (
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-gradient-to-r from-cyan to-magenta flex items-center justify-center">
                <svg className="w-8 h-8 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-xl text-white mb-4">Wallet linked!</h2>
              <p className="text-gray-400 mb-2">
                Your wallet is now linked to <span className="text-cyan">@{session?.user?.twitterUsername}</span>
              </p>
              <p className="text-gray-400 mb-8">
                You can now use holder features like <span className="text-white">!image</span> on X.
              </p>
              <PayButton
                text="Go to X"
                onClick={() => { window.open('https://x.com', '_blank'); }}
              />
            </div>
          )}
        </div>

        {/* Info Section */}
        <div className="mt-12 grid md:grid-cols-2 gap-6">
          <div className="p-6 border border-gray-500/25 rounded-lg">
            <h3 className="text-white mb-2">Why link your wallet?</h3>
            <p className="text-gray-400 text-sm">
              Linking your wallet proves you hold $KAMIYO tokens, unlocking holder-only features like AI image generation on X.
            </p>
          </div>
          <div className="p-6 border border-gray-500/25 rounded-lg">
            <h3 className="text-white mb-2">Is this safe?</h3>
            <p className="text-gray-400 text-sm">
              Yes. Signing a message does not give access to your funds. It only proves you control the wallet.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
