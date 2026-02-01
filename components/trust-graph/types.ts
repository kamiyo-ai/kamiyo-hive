// Trust tiers - agent reputation levels
// Oracle: highest trust, verified track record
// Sentinel: high trust, reliable performance
// Architect: established trust, consistent quality
// Scout: emerging trust, building reputation
// Ghost: unverified, no established reputation
export type Tier = "oracle" | "sentinel" | "architect" | "scout" | "ghost";

export interface TrustNode {
  id: string;
  label: string;
  tier: Tier;
  reputation: number;
  txCount: number;
  position?: [number, number, number];
}

export interface TrustEdge {
  source: string;
  target: string;
  weight: number; // 0-100 trust level
}

export interface TrustGraphStats {
  totalNodes: number;
  totalEdges: number;
  avgTrust: number;
  tierCounts: Record<Tier, number>;
}

// Colors matching the original agent scene
export const TIER_COLORS: Record<Tier, string> = {
  oracle: "#00f0ff",    // cyan - kamiyo color
  sentinel: "#9944ff",  // purple - oracle color
  architect: "#ffaa22", // orange - sage color
  scout: "#ff44f5",     // pink - chaos color
  ghost: "#505050",     // dim gray - unverified
};

export const TIER_GLOW: Record<Tier, string> = {
  oracle: "#00f0ff",
  sentinel: "#9944ff",
  architect: "#ffaa22",
  scout: "#ff44f5",
  ghost: "#333333",
};
