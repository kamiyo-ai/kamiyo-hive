// Re-export from separate file to avoid SSR issues
export { PAYMENT_TIERS, getTierForReputation, getTierRequirements } from './reputation-tiers';

export interface ReputationProofInputs {
  reputationScore: number;
  transactionCount: number;
  minReputation: number;
  minTransactions: number;
  agentsRoot?: string;
}

export interface ReputationProofResult {
  proof: {
    pi_a: [Uint8Array, Uint8Array];
    pi_b: [[Uint8Array, Uint8Array], [Uint8Array, Uint8Array]];
    pi_c: [Uint8Array, Uint8Array];
  };
  publicInputs: {
    agentsRoot: Uint8Array;
    minReputation: number;
    minTransactions: number;
    nullifier: Uint8Array;
  };
  proofBytes: {
    proof_a: Uint8Array;
    proof_b: Uint8Array;
    proof_c: Uint8Array;
  };
}

// Lazy-load the actual implementation to avoid SSR issues with snarkjs
let proverModule: typeof import('./reputation-prover-impl') | null = null;

async function getProverModule() {
  if (!proverModule) {
    proverModule = await import('./reputation-prover-impl');
  }
  return proverModule;
}

export async function generateReputationProof(inputs: ReputationProofInputs): Promise<ReputationProofResult> {
  const mod = await getProverModule();
  return mod.generateReputationProof(inputs);
}
