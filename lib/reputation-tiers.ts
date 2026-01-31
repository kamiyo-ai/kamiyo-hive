export const PAYMENT_TIERS = {
  elite: { minReputation: 95, minTransactions: 100, dailyLimit: 10000 },
  premium: { minReputation: 85, minTransactions: 50, dailyLimit: 2000 },
  basic: { minReputation: 70, minTransactions: 10, dailyLimit: 500 },
  standard: { minReputation: 0, minTransactions: 0, dailyLimit: 100 },
} as const;

export function getTierForReputation(
  reputationScore: number,
  transactionCount: number
): keyof typeof PAYMENT_TIERS {
  if (reputationScore >= 95 && transactionCount >= 100) return 'elite';
  if (reputationScore >= 85 && transactionCount >= 50) return 'premium';
  if (reputationScore >= 70 && transactionCount >= 10) return 'basic';
  return 'standard';
}

export function getTierRequirements(tier: keyof typeof PAYMENT_TIERS) {
  return PAYMENT_TIERS[tier];
}
