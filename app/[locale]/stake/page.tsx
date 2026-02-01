'use client';

import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { useTranslations } from 'next-intl';
import { PublicKey, Transaction, TransactionInstruction, SystemProgram, SYSVAR_RENT_PUBKEY } from '@solana/web3.js';
import { TOKEN_2022_PROGRAM_ID, getAssociatedTokenAddressSync, ASSOCIATED_TOKEN_PROGRAM_ID } from '@solana/spl-token';
import PayButton from '@/components/PayButton';

const STAKING_PROGRAM_ID = new PublicKey('9QZGdEZ13j8fASEuhpj3eVwUPT4BpQjXSabVjRppJW2N');
const KAMIYO_MINT = new PublicKey('Gy55EJmheLyDXiZ7k7CW2FhunD1UgjQxQibuBn3Npump');

const STAKE_DISCRIMINATOR = Buffer.from([206, 176, 202, 18, 200, 209, 179, 108]);
const UNSTAKE_DISCRIMINATOR = Buffer.from([90, 95, 107, 42, 205, 124, 50, 225]);
const CLAIM_DISCRIMINATOR = Buffer.from([4, 144, 132, 71, 116, 23, 151, 80]);

const MIN_STAKE = 100_000;
const DECIMALS = 6;

function toRawAmount(amount: number): bigint {
    return BigInt(Math.floor(amount * Math.pow(10, DECIMALS)));
}

function writeBigUInt64LE(value: bigint): Uint8Array {
    const buffer = new ArrayBuffer(8);
    const view = new DataView(buffer);
    view.setBigUint64(0, value, true);
    return new Uint8Array(buffer);
}

function fromRawAmount(raw: bigint): number {
    return Number(raw) / Math.pow(10, DECIMALS);
}

interface Position {
    stakedAmount: number;
    stakeStartTime: number;
    lastClaimTime: number;
    multiplier: number;
    duration: number;
}

interface PoolStats {
    totalStaked: number;
    totalWeighted: number;
}

interface TxStatus {
    stage: 'signing' | 'sending' | 'confirming';
    signature?: string;
}

function StakeContent() {
    const t = useTranslations('stake');
    const { publicKey, signTransaction, disconnect } = useWallet();
    const { connection } = useConnection();
    const { setVisible } = useWalletModal();

    const [balance, setBalance] = useState<number | null>(null);
    const [position, setPosition] = useState<Position | null>(null);
    const [poolStats, setPoolStats] = useState<PoolStats | null>(null);
    const [stakeAmount, setStakeAmount] = useState('');
    const [unstakeAmount, setUnstakeAmount] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [txStatus, setTxStatus] = useState<TxStatus | null>(null);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const fetchData = useCallback(async () => {
        if (!publicKey) return;

        try {
            const userAta = getAssociatedTokenAddressSync(KAMIYO_MINT, publicKey, false, TOKEN_2022_PROGRAM_ID);
            const ataInfo = await connection.getAccountInfo(userAta);
            if (ataInfo) {
                const rawBalance = ataInfo.data.slice(64, 72);
                const bal = rawBalance.readBigUInt64LE(0);
                setBalance(fromRawAmount(bal));
            } else {
                setBalance(0);
            }

            const [poolPDA] = PublicKey.findProgramAddressSync([Buffer.from('pool')], STAKING_PROGRAM_ID);
            const poolInfo = await connection.getAccountInfo(poolPDA);
            if (poolInfo) {
                const data = poolInfo.data;
                let offset = 8 + 32 + 32 + 32 + 32;
                const totalStaked = data.readBigUInt64LE(offset);
                offset += 8;
                const totalWeighted = data.readBigUInt64LE(offset);
                setPoolStats({
                    totalStaked: fromRawAmount(totalStaked),
                    totalWeighted: fromRawAmount(totalWeighted),
                });
            }

            const [positionPDA] = PublicKey.findProgramAddressSync(
                [Buffer.from('position'), publicKey.toBuffer()],
                STAKING_PROGRAM_ID
            );
            const posInfo = await connection.getAccountInfo(positionPDA);
            if (posInfo) {
                const data = posInfo.data;
                let offset = 8 + 32;
                const stakedAmount = data.readBigUInt64LE(offset);
                offset += 8;
                const stakeStartTime = Number(data.readBigUInt64LE(offset));
                offset += 8;
                const lastClaimTime = Number(data.readBigUInt64LE(offset));

                const now = Math.floor(Date.now() / 1000);
                const duration = now - stakeStartTime;
                const multiplier = getMultiplier(duration);

                setPosition({
                    stakedAmount: fromRawAmount(stakedAmount),
                    stakeStartTime,
                    lastClaimTime,
                    multiplier,
                    duration,
                });
            } else {
                setPosition(null);
            }
        } catch (err) {
            console.error('Error fetching data:', err);
        }
    }, [publicKey, connection]);

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 30000);
        return () => clearInterval(interval);
    }, [fetchData]);

    function getMultiplier(durationSeconds: number): number {
        const days = durationSeconds / 86400;
        if (days >= 180) return 2.0;
        if (days >= 90) return 1.5;
        if (days >= 30) return 1.2;
        return 1.0;
    }

    function getMultiplierLabel(multiplier: number): string {
        if (multiplier >= 2.0) return t('multipliers.labels.180+');
        if (multiplier >= 1.5) return t('multipliers.labels.90+');
        if (multiplier >= 1.2) return t('multipliers.labels.30+');
        return t('multipliers.labels.<30');
    }

    async function handleStake() {
        if (!publicKey || !signTransaction) return;

        const amount = parseFloat(stakeAmount);
        if (isNaN(amount) || amount < MIN_STAKE) {
            setError(t('stake.minError', { amount: MIN_STAKE.toLocaleString() }));
            return;
        }

        setLoading(true);
        setError(null);
        setSuccess(null);
        setTxStatus({ stage: 'signing' });

        try {
            const rawAmount = toRawAmount(amount);
            const [poolPDA] = PublicKey.findProgramAddressSync([Buffer.from('pool')], STAKING_PROGRAM_ID);
            const [positionPDA] = PublicKey.findProgramAddressSync(
                [Buffer.from('position'), publicKey.toBuffer()],
                STAKING_PROGRAM_ID
            );
            const [tokenVault] = PublicKey.findProgramAddressSync([Buffer.from('vault')], STAKING_PROGRAM_ID);
            const [rewardsVault] = PublicKey.findProgramAddressSync([Buffer.from('rewards')], STAKING_PROGRAM_ID);
            const userAta = getAssociatedTokenAddressSync(KAMIYO_MINT, publicKey, false, TOKEN_2022_PROGRAM_ID);

            const amountBuffer = writeBigUInt64LE(rawAmount);
            const data = Buffer.concat([STAKE_DISCRIMINATOR, amountBuffer]);

            const instruction = new TransactionInstruction({
                programId: STAKING_PROGRAM_ID,
                keys: [
                    { pubkey: poolPDA, isSigner: false, isWritable: true },
                    { pubkey: positionPDA, isSigner: false, isWritable: true },
                    { pubkey: tokenVault, isSigner: false, isWritable: true },
                    { pubkey: rewardsVault, isSigner: false, isWritable: true },
                    { pubkey: userAta, isSigner: false, isWritable: true },
                    { pubkey: publicKey, isSigner: true, isWritable: true },
                    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
                    { pubkey: TOKEN_2022_PROGRAM_ID, isSigner: false, isWritable: false },
                    { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
                    { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
                ],
                data,
            });

            const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
            const transaction = new Transaction();
            transaction.add(instruction);
            transaction.recentBlockhash = blockhash;
            transaction.feePayer = publicKey;

            const signed = await signTransaction(transaction);
            setTxStatus({ stage: 'sending' });

            const txid = await connection.sendRawTransaction(signed.serialize(), {
                skipPreflight: true,
                maxRetries: 5,
            });
            setTxStatus({ stage: 'confirming', signature: txid });

            // Poll for confirmation with timeout
            const startTime = Date.now();
            const timeout = 60000; // 60 seconds
            let confirmed = false;

            while (Date.now() - startTime < timeout) {
                const status = await connection.getSignatureStatus(txid);
                if (status.value?.confirmationStatus === 'confirmed' || status.value?.confirmationStatus === 'finalized') {
                    if (status.value.err) {
                        throw new Error(`Transaction failed: ${JSON.stringify(status.value.err)}`);
                    }
                    confirmed = true;
                    break;
                }
                await new Promise(r => setTimeout(r, 2000));
            }

            if (!confirmed) {
                throw new Error(t('tx.confirmationTimeout'));
            }

            setSuccess(t('tx.staked', { amount: amount.toLocaleString() }));
            setStakeAmount('');
            fetchData();
        } catch (err: any) {
            console.error('Stake error:', err);
            setError(err.message || 'Transaction failed');
        } finally {
            setLoading(false);
            setTxStatus(null);
        }
    }

    async function handleUnstake() {
        if (!publicKey || !signTransaction || !position) return;

        const amount = parseFloat(unstakeAmount);
        if (isNaN(amount) || amount <= 0 || amount > position.stakedAmount) {
            setError(t('unstake.invalidAmount'));
            return;
        }

        setLoading(true);
        setError(null);
        setSuccess(null);
        setTxStatus({ stage: 'signing' });

        try {
            const rawAmount = toRawAmount(amount);
            const [poolPDA] = PublicKey.findProgramAddressSync([Buffer.from('pool')], STAKING_PROGRAM_ID);
            const [positionPDA] = PublicKey.findProgramAddressSync(
                [Buffer.from('position'), publicKey.toBuffer()],
                STAKING_PROGRAM_ID
            );
            const [tokenVault] = PublicKey.findProgramAddressSync([Buffer.from('vault')], STAKING_PROGRAM_ID);
            const [rewardsVault] = PublicKey.findProgramAddressSync([Buffer.from('rewards')], STAKING_PROGRAM_ID);
            const userAta = getAssociatedTokenAddressSync(KAMIYO_MINT, publicKey, false, TOKEN_2022_PROGRAM_ID);

            const amountBuffer = writeBigUInt64LE(rawAmount);
            const data = Buffer.concat([UNSTAKE_DISCRIMINATOR, amountBuffer]);

            const instruction = new TransactionInstruction({
                programId: STAKING_PROGRAM_ID,
                keys: [
                    { pubkey: poolPDA, isSigner: false, isWritable: true },
                    { pubkey: positionPDA, isSigner: false, isWritable: true },
                    { pubkey: tokenVault, isSigner: false, isWritable: true },
                    { pubkey: rewardsVault, isSigner: false, isWritable: true },
                    { pubkey: userAta, isSigner: false, isWritable: true },
                    { pubkey: publicKey, isSigner: false, isWritable: false },
                    { pubkey: publicKey, isSigner: true, isWritable: false },
                    { pubkey: TOKEN_2022_PROGRAM_ID, isSigner: false, isWritable: false },
                ],
                data,
            });

            const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
            const transaction = new Transaction();
            transaction.add(instruction);
            transaction.recentBlockhash = blockhash;
            transaction.feePayer = publicKey;

            const signed = await signTransaction(transaction);
            setTxStatus({ stage: 'sending' });

            const txid = await connection.sendRawTransaction(signed.serialize(), {
                skipPreflight: true,
                maxRetries: 5,
            });
            setTxStatus({ stage: 'confirming', signature: txid });

            // Poll for confirmation with timeout
            const startTime = Date.now();
            const timeout = 60000;
            let confirmed = false;

            while (Date.now() - startTime < timeout) {
                const status = await connection.getSignatureStatus(txid);
                if (status.value?.confirmationStatus === 'confirmed' || status.value?.confirmationStatus === 'finalized') {
                    if (status.value.err) {
                        throw new Error(`Transaction failed: ${JSON.stringify(status.value.err)}`);
                    }
                    confirmed = true;
                    break;
                }
                await new Promise(r => setTimeout(r, 2000));
            }

            if (!confirmed) {
                throw new Error('Transaction confirmation timeout. Check Solscan for status.');
            }

            setSuccess(`Unstaked ${amount.toLocaleString()} KAMIYO`);
            setUnstakeAmount('');
            fetchData();
        } catch (err: any) {
            console.error('Unstake error:', err);
            setError(err.message || 'Transaction failed');
        } finally {
            setLoading(false);
            setTxStatus(null);
        }
    }

    async function handleClaim() {
        if (!publicKey || !signTransaction || !position) return;

        setLoading(true);
        setError(null);
        setSuccess(null);
        setTxStatus({ stage: 'signing' });

        try {
            const [poolPDA] = PublicKey.findProgramAddressSync([Buffer.from('pool')], STAKING_PROGRAM_ID);
            const [positionPDA] = PublicKey.findProgramAddressSync(
                [Buffer.from('position'), publicKey.toBuffer()],
                STAKING_PROGRAM_ID
            );
            const [rewardsVault] = PublicKey.findProgramAddressSync([Buffer.from('rewards')], STAKING_PROGRAM_ID);
            const userAta = getAssociatedTokenAddressSync(KAMIYO_MINT, publicKey, false, TOKEN_2022_PROGRAM_ID);

            const instruction = new TransactionInstruction({
                programId: STAKING_PROGRAM_ID,
                keys: [
                    { pubkey: poolPDA, isSigner: false, isWritable: false },
                    { pubkey: positionPDA, isSigner: false, isWritable: true },
                    { pubkey: rewardsVault, isSigner: false, isWritable: true },
                    { pubkey: userAta, isSigner: false, isWritable: true },
                    { pubkey: publicKey, isSigner: false, isWritable: false },
                    { pubkey: publicKey, isSigner: true, isWritable: false },
                    { pubkey: TOKEN_2022_PROGRAM_ID, isSigner: false, isWritable: false },
                ],
                data: CLAIM_DISCRIMINATOR,
            });

            const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
            const transaction = new Transaction();
            transaction.add(instruction);
            transaction.recentBlockhash = blockhash;
            transaction.feePayer = publicKey;

            const signed = await signTransaction(transaction);
            setTxStatus({ stage: 'sending' });

            const txid = await connection.sendRawTransaction(signed.serialize(), {
                skipPreflight: true,
                maxRetries: 5,
            });
            setTxStatus({ stage: 'confirming', signature: txid });

            // Poll for confirmation with timeout
            const startTime = Date.now();
            const timeout = 60000;
            let confirmed = false;

            while (Date.now() - startTime < timeout) {
                const status = await connection.getSignatureStatus(txid);
                if (status.value?.confirmationStatus === 'confirmed' || status.value?.confirmationStatus === 'finalized') {
                    if (status.value.err) {
                        throw new Error(`Transaction failed: ${JSON.stringify(status.value.err)}`);
                    }
                    confirmed = true;
                    break;
                }
                await new Promise(r => setTimeout(r, 2000));
            }

            if (!confirmed) {
                throw new Error('Transaction confirmation timeout. Check Solscan for status.');
            }

            setSuccess('Rewards claimed');
            fetchData();
        } catch (err: any) {
            console.error('Claim error:', err);
            setError(err.message || 'Transaction failed');
        } finally {
            setLoading(false);
            setTxStatus(null);
        }
    }

    return (
        <div className="min-h-screen bg-black text-white">
            {/* Transaction Progress Modal - rendered via portal */}
            {mounted && (txStatus || success) && createPortal(
                <div className="fixed top-0 left-0 right-0 bottom-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm">
                    <div className="bg-black border border-gray-500/25 rounded-lg p-8 max-w-md w-full mx-4">
                        {success ? (
                            <div className="text-center">
                                <h3 className="text-xl text-white mb-2">Transaction Confirmed</h3>
                                <p className="text-gray-400 mb-8">{success}</p>
                                <div className="flex justify-center">
                                    <PayButton
                                        text="Continue"
                                        onClick={() => setSuccess(null)}
                                    />
                                </div>
                            </div>
                        ) : txStatus && (
                            <>
                                <h3 className="text-lg text-white mb-6 text-center">
                                    {txStatus.stage === 'signing' && 'Waiting for signature...'}
                                    {txStatus.stage === 'sending' && 'Sending transaction...'}
                                    {txStatus.stage === 'confirming' && 'Confirming transaction...'}
                                </h3>

                                {/* Progress bar */}
                                <div className="h-1 bg-gray-800 rounded-full overflow-hidden mb-6">
                                    <div
                                        className="h-full transition-all duration-500 ease-out"
                                        style={{
                                            width: txStatus.stage === 'signing' ? '33%' : txStatus.stage === 'sending' ? '66%' : '90%',
                                            background: 'linear-gradient(90deg, #4fe9ea, #ff44f5)',
                                        }}
                                    />
                                </div>

                                {/* Stage indicators */}
                                <div className="flex justify-between text-xs mb-6">
                                    <span className={txStatus.stage === 'signing' ? 'text-cyan' : 'text-gray-500'}>
                                        Sign
                                    </span>
                                    <span className={txStatus.stage === 'sending' ? 'text-cyan' : 'text-gray-500'}>
                                        Send
                                    </span>
                                    <span className={txStatus.stage === 'confirming' ? 'text-cyan' : 'text-gray-500'}>
                                        Confirm
                                    </span>
                                </div>

                                {/* Solscan link */}
                                {txStatus.signature && (
                                    <a
                                        href={`https://solscan.io/tx/${txStatus.signature}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="block text-center text-sm text-gray-400 hover:text-cyan transition-colors"
                                    >
                                        View on Solscan
                                    </a>
                                )}
                            </>
                        )}
                    </div>
                </div>,
                document.body
            )}

            <div className="w-full px-5 mx-auto max-w-[1400px] pt-24 md:pt-28 pb-8 md:pb-16">
                <div className="mb-8 md:mb-16">
                    <p className="font-light text-sm uppercase tracking-widest gradient-text mb-4">
                        — Staking ステーキング
                    </p>
                    <h1 className="text-3xl md:text-4xl text-white mb-4">Staking</h1>
                    <p className="text-gray-400 max-w-2xl">
                        Stake $KAMIYO and earn up to 24% APY with duration multipliers. No lock period, flexible unstaking.
                    </p>
                </div>

                {poolStats && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-8 md:mb-12">
                        <div className="bg-black border border-gray-500/25 rounded-lg p-5 text-center">
                            <div className="gradient-text text-xs uppercase tracking-wider mb-2">Total Staked</div>
                            <div className="text-white text-2xl font-light mb-1">
                                {poolStats.totalStaked.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            </div>
                            <div className="text-gray-500 text-xs">KAMIYO</div>
                        </div>
                        <div className="bg-black border border-gray-500/25 rounded-lg p-5 text-center">
                            <div className="gradient-text text-xs uppercase tracking-wider mb-2">Base APY</div>
                            <div className="text-white text-2xl font-light mb-1">12%</div>
                            <div className="text-gray-500 text-xs">annual</div>
                        </div>
                        <div className="bg-black border border-gray-500/25 rounded-lg p-5 text-center">
                            <div className="gradient-text text-xs uppercase tracking-wider mb-2">Max APY</div>
                            <div className="text-white text-2xl font-light mb-1">24%</div>
                            <div className="text-gray-500 text-xs">with 2x multiplier</div>
                        </div>
                        <div className="bg-black border border-gray-500/25 rounded-lg p-5 text-center">
                            <div className="gradient-text text-xs uppercase tracking-wider mb-2">Minimum</div>
                            <div className="text-white text-2xl font-light mb-1">100K</div>
                            <div className="text-gray-500 text-xs">KAMIYO</div>
                        </div>
                    </div>
                )}

                {error && (
                    <div className="mb-6 p-4 bg-red-500/10 border border-red-500/25 rounded-lg">
                        <p className="text-red-400 text-sm">{error}</p>
                    </div>
                )}
                
                <div className="grid md:grid-cols-2 gap-4 md:gap-8">
                    <div className="card relative p-6 rounded-xl border border-gray-500/25">
                        <h2 className="text-xl text-white mb-6 pb-2 subheading-border">Your Position</h2>

                        {!publicKey ? (
                            <div className="text-center py-8">
                                <p className="text-gray-400 mb-6">Connect wallet to stake</p>
                                <PayButton
                                    text="Connect Wallet"
                                    onClick={() => setVisible(true)}
                                />
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="flex justify-between items-center py-2 border-b border-gray-800">
                                    <span className="text-gray-400 text-sm">Wallet Balance</span>
                                    <span className="text-white">{balance !== null ? balance.toLocaleString() : '...'} KAMIYO</span>
                                </div>

                                {position ? (
                                    <>
                                        <div className="flex justify-between items-center py-2 border-b border-gray-800">
                                            <span className="text-gray-400 text-sm">Staked Amount</span>
                                            <span className="text-cyan">{position.stakedAmount.toLocaleString()} KAMIYO</span>
                                        </div>
                                        <div className="flex justify-between items-center py-2 border-b border-gray-800">
                                            <span className="text-gray-400 text-sm">Multiplier</span>
                                            <span className="text-magenta">{position.multiplier}x</span>
                                        </div>
                                        <div className="flex justify-between items-center py-2 border-b border-gray-800">
                                            <span className="text-gray-400 text-sm">Duration</span>
                                            <span className="text-white">{getMultiplierLabel(position.multiplier)}</span>
                                        </div>
                                        <div className="flex justify-between items-center py-2 border-b border-gray-800">
                                            <span className="text-gray-400 text-sm">Effective APY</span>
                                            <span className="text-white">{(12 * position.multiplier).toFixed(1)}%</span>
                                        </div>
                                    </>
                                ) : (
                                    <div className="py-4 text-center">
                                        <p className="text-gray-500 text-sm">No active stake</p>
                                    </div>
                                )}

                                <div className="pt-4 flex items-center justify-between">
                                    <span className="text-gray-500 text-xs font-mono">
                                        {publicKey.toBase58().slice(0, 4)}...{publicKey.toBase58().slice(-4)}
                                    </span>
                                    <button
                                        onClick={() => disconnect()}
                                        className="text-sm text-magenta hover:opacity-80 transition-opacity"
                                    >
                                        Disconnect
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="card relative p-6 rounded-xl border border-gray-500/25">
                        <h2 className="text-xl text-white mb-6 pb-2 subheading-border">Stake</h2>

                        {!publicKey ? (
                            <div className="text-center py-8">
                                <p className="text-gray-400 mb-6">Connect wallet to stake</p>
                                <PayButton
                                    text="Connect Wallet"
                                    onClick={() => setVisible(true)}
                                />
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-gray-400 text-xs uppercase tracking-wider mb-2">
                                        Amount (min 100,000)
                                    </label>
                                    <div className="flex gap-2">
                                        <input
                                            type="number"
                                            value={stakeAmount}
                                            onChange={(e) => setStakeAmount(e.target.value)}
                                            placeholder="100000"
                                            min={MIN_STAKE}
                                            disabled={loading}
                                            className="flex-1 bg-black border border-gray-500/50 rounded px-4 py-3 text-white text-sm focus:border-[#364153] focus:outline-none transition-colors disabled:opacity-50"
                                        />
                                        {balance !== null && (
                                            <button
                                                onClick={() => setStakeAmount(Math.floor(balance).toString())}
                                                disabled={loading}
                                                className="px-4 py-2 text-xs border border-gray-500/50 rounded text-gray-400 hover:text-white hover:border-gray-400 transition-all disabled:opacity-50"
                                            >
                                                Max
                                            </button>
                                        )}
                                    </div>
                                </div>

                                <div className="pt-4 flex justify-center">
                                    <PayButton
                                        text={loading ? "Processing..." : "Stake KAMIYO"}
                                        disabled={loading || !stakeAmount}
                                        onClick={handleStake}
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="card relative p-6 rounded-xl border border-gray-500/25">
                        <h2 className="text-xl text-white mb-6 pb-2 subheading-border">Unstake</h2>

                        {!publicKey ? (
                            <div className="text-center py-8">
                                <p className="text-gray-400 mb-6">Connect wallet to unstake</p>
                                <PayButton
                                    text="Connect Wallet"
                                    onClick={() => setVisible(true)}
                                />
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-gray-400 text-xs uppercase tracking-wider mb-2">
                                        Amount
                                    </label>
                                    <div className="flex gap-2">
                                        <input
                                            type="number"
                                            value={unstakeAmount}
                                            onChange={(e) => setUnstakeAmount(e.target.value)}
                                            placeholder="0"
                                            disabled={loading || !position}
                                            className="flex-1 bg-black border border-gray-500/50 rounded px-4 py-3 text-white text-sm focus:border-[#364153] focus:outline-none transition-colors disabled:opacity-50"
                                        />
                                        {position && (
                                            <button
                                                onClick={() => setUnstakeAmount(position.stakedAmount.toString())}
                                                disabled={loading}
                                                className="px-4 py-2 text-xs border border-gray-500/50 rounded text-gray-400 hover:text-white hover:border-gray-400 transition-all disabled:opacity-50"
                                            >
                                                Max
                                            </button>
                                        )}
                                    </div>
                                </div>

                                <p className="text-gray-500 text-xs">
                                    Unstaking resets your duration multiplier. Pending rewards are claimed automatically.
                                </p>

                                <div className="pt-4 flex justify-center">
                                    <PayButton
                                        text={loading ? "Processing..." : "Unstake"}
                                        disabled={loading || !position || !unstakeAmount}
                                        onClick={handleUnstake}
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="card relative p-6 rounded-xl border border-gray-500/25">
                        <h2 className="text-xl text-white mb-6 pb-2 subheading-border">Claim Rewards</h2>

                        {!publicKey ? (
                            <div className="text-center py-8">
                                <p className="text-gray-400 mb-6">Connect wallet to claim</p>
                                <PayButton
                                    text="Connect Wallet"
                                    onClick={() => setVisible(true)}
                                />
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <p className="text-gray-400 text-sm">
                                    Claim your accumulated staking rewards. Rewards are distributed from the rewards vault.
                                </p>

                                <div className="pt-4 flex justify-center">
                                    <PayButton
                                        text={loading ? "Processing..." : "Claim Rewards"}
                                        disabled={loading || !position}
                                        onClick={handleClaim}
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="border-t border-gray-800 pt-12 mt-12">
                    <h4 className="text-xl md:text-2xl mb-4 font-light text-center">Duration Multipliers</h4>
                    <p className="text-gray-500 text-sm text-center mb-8">
                        Your multiplier increases automatically based on how long you stake
                    </p>
                    <div className="md:max-w-2xl md:mx-auto">
                        <div className="border border-gray-800 rounded-lg overflow-hidden">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-900/50">
                                    <tr>
                                        <th className="text-left p-4 text-gray-400 font-light">Duration</th>
                                        <th className="text-left p-4 text-gray-400 font-light">Multiplier</th>
                                        <th className="text-left p-4 text-gray-400 font-light">Effective APY</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-800">
                                    <tr>
                                        <td className="p-4 text-white">0-30 days</td>
                                        <td className="p-4 text-gray-400">1.0x</td>
                                        <td className="p-4 text-cyan">12%</td>
                                    </tr>
                                    <tr>
                                        <td className="p-4 text-white">30-90 days</td>
                                        <td className="p-4 text-gray-400">1.2x</td>
                                        <td className="p-4 text-cyan">14.4%</td>
                                    </tr>
                                    <tr>
                                        <td className="p-4 text-white">90-180 days</td>
                                        <td className="p-4 text-gray-400">1.5x</td>
                                        <td className="p-4 text-cyan">18%</td>
                                    </tr>
                                    <tr>
                                        <td className="p-4 text-white">180+ days</td>
                                        <td className="p-4 text-magenta">2.0x</td>
                                        <td className="p-4 text-magenta">24%</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}

export default StakeContent;
