declare module '@kamiyo/x402-client' {
  export type ReputationTier = {
    minReputation: number;
    maxReputation: number;
    discount: number;
    label: string;
  };

  export interface X402KamiyoClient {
    createEscrow(providerPk: unknown, amountLamports: number, hireId: string): Promise<{
      success: boolean;
      transactionId?: string;
      escrowPda?: { toBase58(): string };
      error?: { message?: string };
    }>;
    releaseEscrow(hireId: string): Promise<void>;
    disputeEscrow(hireId: string): Promise<void>;
  }

  export class CreditTracker {
    repayCredit(agentId: string, amount: number): Promise<void>;
  }

  export class DynamicCreditTracker {
    recordEscrowOutcome(
      agentId: string,
      outcome: 'released' | 'dispute_lost',
      quality: number
    ): Promise<void>;
  }

  export const DEFAULT_TIERS: ReputationTier[];
  export function getTierForThreshold(reputation: number, tiers?: ReputationTier[]): ReputationTier;
  export function calculateReputationPrice(
    basePrice: number,
    reputation: number,
    tiers?: ReputationTier[]
  ): { price: number; discount: number; tier: ReputationTier };
}
