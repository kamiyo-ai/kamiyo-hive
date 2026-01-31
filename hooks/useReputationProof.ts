'use client';

import { useState, useCallback } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { Transaction, TransactionInstruction, PublicKey, SystemProgram } from '@solana/web3.js';
import { getTierForReputation, PAYMENT_TIERS } from '@/lib/reputation-tiers';
import type { ReputationProofInputs, ReputationProofResult } from '@/lib/reputation-prover';

const KAMIYO_PROGRAM_ID = new PublicKey('8sUnNU6WBD2SYapCE12S7LwH1b8zWoniytze7ifWwXCM');
const DISCRIMINATOR = Buffer.from([0x25, 0xac, 0xf8, 0x03, 0x03, 0xa3, 0x91, 0x55]);

interface UseReputationProofReturn {
  generating: boolean;
  verifying: boolean;
  error: string | null;
  proof: ReputationProofResult | null;
  txSignature: string | null;
  generateProof: (inputs: ReputationProofInputs) => Promise<ReputationProofResult | null>;
  verifyOnChain: (proof: ReputationProofResult) => Promise<string | null>;
  currentTier: keyof typeof PAYMENT_TIERS;
}

export function useReputationProof(
  reputationScore: number = 0,
  transactionCount: number = 0
): UseReputationProofReturn {
  const { connection } = useConnection();
  const wallet = useWallet();

  const [generating, setGenerating] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [proof, setProof] = useState<ReputationProofResult | null>(null);
  const [txSignature, setTxSignature] = useState<string | null>(null);

  const currentTier = getTierForReputation(reputationScore, transactionCount);

  const generateProof = useCallback(async (inputs: ReputationProofInputs) => {
    setGenerating(true);
    setError(null);
    setProof(null);

    try {
      const { generateReputationProof } = await import('@/lib/reputation-prover');
      const result = await generateReputationProof(inputs);
      setProof(result);
      return result;
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to generate proof';
      setError(message);
      return null;
    } finally {
      setGenerating(false);
    }
  }, []);

  const verifyOnChain = useCallback(async (proofResult: ReputationProofResult) => {
    if (!wallet.publicKey || !wallet.signTransaction) {
      setError('Wallet not connected');
      return null;
    }

    setVerifying(true);
    setError(null);
    setTxSignature(null);

    try {
      const { proofBytes, publicInputs } = proofResult;

      if (proofBytes.proof_a.length !== 64) throw new Error('bad proof_a');
      if (proofBytes.proof_b.length !== 128) throw new Error('bad proof_b');
      if (proofBytes.proof_c.length !== 64) throw new Error('bad proof_c');
      if (publicInputs.agentsRoot.length !== 32) throw new Error('bad agentsRoot');
      if (publicInputs.nullifier.length !== 32) throw new Error('bad nullifier');

      const [nullifierPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('nullifier'), Buffer.from(publicInputs.nullifier)],
        KAMIYO_PROGRAM_ID
      );

      if (await connection.getAccountInfo(nullifierPda)) {
        throw new Error('nullifier already used');
      }

      const data = Buffer.alloc(333); // 8 + 64 + 128 + 64 + 32 + 1 + 4 + 32
      let off = 0;
      DISCRIMINATOR.copy(data, off); off += 8;
      Buffer.from(proofBytes.proof_a).copy(data, off); off += 64;
      Buffer.from(proofBytes.proof_b).copy(data, off); off += 128;
      Buffer.from(proofBytes.proof_c).copy(data, off); off += 64;
      Buffer.from(publicInputs.agentsRoot).copy(data, off); off += 32;
      data.writeUInt8(publicInputs.minReputation, off); off += 1;
      data.writeUInt32LE(publicInputs.minTransactions, off); off += 4;
      Buffer.from(publicInputs.nullifier).copy(data, off);

      const ix = new TransactionInstruction({
        keys: [
          { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
          { pubkey: nullifierPda, isSigner: false, isWritable: true },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        programId: KAMIYO_PROGRAM_ID,
        data,
      });

      const tx = new Transaction().add(ix);
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('finalized');
      tx.recentBlockhash = blockhash;
      tx.feePayer = wallet.publicKey;

      const signed = await wallet.signTransaction(tx);
      const signature = await connection.sendRawTransaction(signed.serialize(), {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
      });

      await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, 'confirmed');

      setTxSignature(signature);
      return signature;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'verification failed';
      setError(msg.includes('0x1') ? 'invalid proof' : msg);
      return null;
    } finally {
      setVerifying(false);
    }
  }, [connection, wallet]);

  return {
    generating,
    verifying,
    error,
    proof,
    txSignature,
    generateProof,
    verifyOnChain,
    currentTier,
  };
}
