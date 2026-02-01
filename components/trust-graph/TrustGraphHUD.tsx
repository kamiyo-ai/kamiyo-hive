"use client";

import { useState, useCallback } from "react";
import type { TrustNode, TrustGraphStats, Tier } from "./types";
import { TIER_COLORS } from "./types";

interface TrustGraphHUDProps {
  stats: TrustGraphStats;
  selectedNode: TrustNode | null;
  onSearch: (query: string) => void;
  onFilterTier: (tier: Tier | "all") => void;
  onClearSelection: () => void;
  loading?: boolean;
}

const TIERS: Array<{ value: Tier | "all"; label: string }> = [
  { value: "all", label: "All Tiers" },
  { value: "oracle", label: "Oracle" },
  { value: "sentinel", label: "Sentinel" },
  { value: "architect", label: "Architect" },
  { value: "scout", label: "Scout" },
  { value: "ghost", label: "Ghost" },
];

export function TrustGraphHUD({
  stats,
  selectedNode,
  onSearch,
  onFilterTier,
  onClearSelection,
  loading = false,
}: TrustGraphHUDProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTier, setSelectedTier] = useState<Tier | "all">("all");

  const handleSearch = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setSearchQuery(value);
      onSearch(value);
    },
    [onSearch]
  );

  const handleTierChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const value = e.target.value as Tier | "all";
      setSelectedTier(value);
      onFilterTier(value);
    },
    [onFilterTier]
  );

  return (
    <div className="absolute top-0 left-0 bottom-0 w-[280px] bg-black/95 border-r border-gray-500/25 flex flex-col z-10">
      {/* Header */}
      <div className="p-5 border-b border-gray-500/25">
        <h1 className="text-lg text-white mb-1">Trust Graph</h1>
        <p className="text-gray-500 text-xs">Agent reputation network</p>
      </div>

      {/* Search */}
      <div className="p-4 border-b border-gray-500/25">
        <label className="block text-gray-500 text-xs uppercase tracking-wider mb-2">
          Search Agent
        </label>
        <input
          type="text"
          value={searchQuery}
          onChange={handleSearch}
          placeholder="Agent ID or name..."
          className="w-full px-3 py-2 bg-black border border-gray-500/50 rounded text-white text-sm focus:border-cyan focus:outline-none transition-colors"
        />
      </div>

      {/* Filter */}
      <div className="p-4 border-b border-gray-500/25">
        <label className="block text-gray-500 text-xs uppercase tracking-wider mb-2">
          Filter by Tier
        </label>
        <select
          value={selectedTier}
          onChange={handleTierChange}
          className="w-full px-3 py-2 bg-black border border-gray-500/50 rounded text-white text-sm focus:border-cyan focus:outline-none transition-colors cursor-pointer"
        >
          {TIERS.map((tier) => (
            <option key={tier.value} value={tier.value}>
              {tier.label}
            </option>
          ))}
        </select>
      </div>

      {/* Stats */}
      <div className="p-4 border-b border-gray-500/25">
        <h2 className="text-xs text-gray-500 uppercase tracking-wider mb-4">
          Network Stats
        </h2>
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-gray-400 text-sm">Total Nodes</span>
            <span className="text-white text-sm">{stats.totalNodes}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-400 text-sm">Total Edges</span>
            <span className="text-white text-sm">{stats.totalEdges}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-400 text-sm">Avg Trust</span>
            <span className="text-cyan text-sm">{stats.avgTrust}%</span>
          </div>
        </div>
      </div>

      {/* Tier Distribution */}
      <div className="p-4 border-b border-gray-500/25">
        <h2 className="text-xs text-gray-500 uppercase tracking-wider mb-4">
          Tier Distribution
        </h2>
        <div className="space-y-2">
          {(Object.entries(stats.tierCounts) as [Tier, number][]).map(
            ([tier, count]) => (
              <div
                key={tier}
                className="flex items-center gap-3"
              >
                <div
                  className="w-2 h-2 rounded-full"
                  style={{
                    background: TIER_COLORS[tier],
                    boxShadow: `0 0 6px ${TIER_COLORS[tier]}`,
                  }}
                />
                <span className="flex-1 text-gray-400 text-sm capitalize">
                  {tier}
                </span>
                <span className="text-white text-sm">{count}</span>
              </div>
            )
          )}
        </div>
      </div>

      {/* Selected Node */}
      {selectedNode && (
        <div className="p-4 border-b border-gray-500/25">
          <h2 className="text-xs uppercase tracking-wider mb-4 gradient-text">
            Selected Agent
          </h2>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{
                  background: TIER_COLORS[selectedNode.tier],
                  boxShadow: `0 0 8px ${TIER_COLORS[selectedNode.tier]}`,
                }}
              />
              <span className="text-white font-normal">
                {selectedNode.label}
              </span>
            </div>
            <div className="text-xs text-gray-500">
              ID: {selectedNode.id}
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400 text-sm">Tier</span>
              <span className="text-sm capitalize" style={{ color: TIER_COLORS[selectedNode.tier] }}>
                {selectedNode.tier}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400 text-sm">Reputation</span>
              <span className="text-white text-sm">{selectedNode.reputation}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400 text-sm">TX Count</span>
              <span className="text-white text-sm">{selectedNode.txCount.toLocaleString()}</span>
            </div>
            <button
              onClick={onClearSelection}
              className="mt-2 w-full px-3 py-2 text-xs border border-gray-500/50 rounded text-gray-400 hover:text-white hover:border-gray-400 transition-all"
            >
              Clear selection
            </button>
          </div>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="p-5 text-center text-gray-500 text-sm">
          Loading graph...
        </div>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Legend */}
      <div className="p-4 border-t border-gray-500/25">
        <p className="text-xs text-gray-600">
          Drag to rotate. Scroll to zoom. Click node to select.
        </p>
      </div>
    </div>
  );
}
