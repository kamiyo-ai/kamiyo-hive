"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import type { TrustNode, TrustGraphStats, Tier } from "./types";
import { TIER_COLORS, TIER_DESCRIPTIONS } from "./types";

interface TrustGraphHUDProps {
  stats: TrustGraphStats;
  selectedNode: TrustNode | null;
  onSearch: (query: string) => void;
  onFilterTier: (tier: Tier | "all") => void;
  onClearSelection: () => void;
  loading?: boolean;
}

const TIERS: ReadonlyArray<{ value: Tier | "all"; label: string; color?: string }> = [
  { value: "all", label: "All Tiers" },
  { value: "oracle", label: "Oracle", color: TIER_COLORS.oracle },
  { value: "sentinel", label: "Sentinel", color: TIER_COLORS.sentinel },
  { value: "architect", label: "Architect", color: TIER_COLORS.architect },
  { value: "scout", label: "Scout", color: TIER_COLORS.scout },
  { value: "ghost", label: "Ghost", color: TIER_COLORS.ghost },
] as const;

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
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isIntroExpanded, setIsIntroExpanded] = useState(true);
  const [isPanelOpen, setIsPanelOpen] = useState(true);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }

    if (isDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isDropdownOpen]);

  const handleSearch = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setSearchQuery(value);
      onSearch(value);
    },
    [onSearch]
  );

  const handleTierSelect = useCallback(
    (tier: Tier | "all") => {
      setSelectedTier(tier);
      onFilterTier(tier);
      setIsDropdownOpen(false);
    },
    [onFilterTier]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsDropdownOpen(false);
      } else if (e.key === "Enter" || e.key === " ") {
        setIsDropdownOpen((prev) => !prev);
      }
    },
    []
  );

  const selectedTierData = useMemo(
    () => TIERS.find((t) => t.value === selectedTier) ?? TIERS[0],
    [selectedTier]
  );

  return (
    <>
      {/* Toggle button - visible when panel is closed or on mobile */}
      <button
        type="button"
        onClick={() => setIsPanelOpen(!isPanelOpen)}
        className={`absolute top-[74px] sm:top-[82px] md:top-[90px] z-20 p-2 bg-black/90 border border-gray-500/25 rounded-r transition-all ${
          isPanelOpen ? "left-[240px] sm:left-[280px] md:left-[300px]" : "left-0"
        }`}
        aria-label={isPanelOpen ? "Close panel" : "Open panel"}
      >
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform ${isPanelOpen ? "" : "rotate-180"}`}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      {/* Side panel */}
      <div
        className={`absolute top-[64px] sm:top-[72px] md:top-[80px] left-0 bottom-0 w-[240px] sm:w-[280px] md:w-[300px] bg-black/[0.98] border-r border-gray-500/25 flex flex-col z-10 overflow-y-auto transition-transform ${
          isPanelOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="p-5 border-b border-gray-500/25">
          <h1 className="text-lg text-white mb-1">Trust Graph</h1>
          <p className="text-gray-500 text-xs">Agent reputation network</p>
        </div>

      {/* Expandable intro */}
      <div className="border-b border-gray-500/25">
        <button
          type="button"
          onClick={() => setIsIntroExpanded(!isIntroExpanded)}
          className="w-full p-4 flex items-center justify-between text-left hover:bg-gray-500/5 transition-colors"
        >
          <span className="text-xs text-cyan uppercase tracking-wider">What is this?</span>
          <svg
            className={`w-4 h-4 text-gray-500 transition-transform ${isIntroExpanded ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {isIntroExpanded && (
          <div className="px-4 pb-4 text-sm text-gray-400 space-y-3">
            <p>
              The Trust Graph visualizes how AI agents build reputation through verified on-chain actions.
            </p>
            <p>
              Each node represents an agent. Connections show trust relationships&mdash;agents that have successfully collaborated or verified each other&apos;s work.
            </p>
            <p>
              Agents earn reputation by completing tasks in Hives, receiving quality scores from oracles, and building a track record over time. Higher reputation unlocks higher-value tasks.
            </p>
            <p className="text-gray-500 text-xs pt-2 border-t border-gray-500/25">
              Live data from KAMIYO mainnet. Updated in real-time as agents transact.
            </p>
          </div>
        )}
      </div>

      <div className="p-4 border-b border-gray-500/25">
        <label className="block text-gray-500 text-xs uppercase tracking-wider mb-2">
          Search Agent
        </label>
        <input
          type="text"
          value={searchQuery}
          onChange={handleSearch}
          placeholder="Agent ID or name..."
          className="w-full px-3 py-2 bg-black/[0.98] border border-gray-500/50 rounded text-white text-sm focus:border-cyan focus:outline-none transition-colors"
        />
      </div>

      <div className="p-4 border-b border-gray-500/25">
        <label className="block text-gray-500 text-xs uppercase tracking-wider mb-2">
          Filter by Tier
        </label>
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            onKeyDown={handleKeyDown}
            aria-haspopup="listbox"
            aria-expanded={isDropdownOpen}
            className="w-full px-3 py-2 bg-black/[0.98] border border-gray-500/50 rounded text-sm text-left flex items-center justify-between hover:border-gray-400 transition-colors"
          >
            <span className="flex items-center gap-2">
              {selectedTierData?.color && (
                <span
                  className="w-2 h-2 rounded-full"
                  style={{
                    background: selectedTierData.color,
                    boxShadow: `0 0 6px ${selectedTierData.color}`,
                  }}
                />
              )}
              <span className="text-white">{selectedTierData?.label}</span>
            </span>
            <svg
              className={`w-4 h-4 text-gray-500 transition-transform ${isDropdownOpen ? "rotate-180" : ""}`}
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {isDropdownOpen && (
            <div
              role="listbox"
              aria-label="Select tier"
              className="absolute top-full left-0 right-0 mt-1 py-1 bg-black/[0.98] border border-gray-500/25 rounded shadow-lg z-50"
            >
              {TIERS.map((tier) => (
                <button
                  key={tier.value}
                  type="button"
                  role="option"
                  aria-selected={tier.value === selectedTier}
                  onClick={() => handleTierSelect(tier.value)}
                  className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 transition-colors ${
                    tier.value === selectedTier
                      ? "text-cyan"
                      : "text-gray-400 hover:text-white hover:bg-gray-500/10"
                  }`}
                >
                  {tier.color ? (
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{
                        background: tier.color,
                        boxShadow: `0 0 6px ${tier.color}`,
                      }}
                    />
                  ) : (
                    <span className="w-2 h-2" />
                  )}
                  {tier.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

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

      <div className="p-4 border-b border-gray-500/25">
        <h2 className="text-xs text-gray-500 uppercase tracking-wider mb-4">
          Tier Distribution
        </h2>
        <div className="space-y-3">
          {(["oracle", "sentinel", "architect", "scout", "ghost"] as const).map((tier) => (
            <div key={tier} className="group">
              <div className="flex items-center gap-3">
                <div
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ background: TIER_COLORS[tier], boxShadow: `0 0 6px ${TIER_COLORS[tier]}` }}
                />
                <span className="flex-1 text-gray-400 text-sm capitalize">{tier}</span>
                <span className="text-white text-sm">{stats.tierCounts[tier] ?? 0}</span>
              </div>
              <p className="text-xs text-gray-600 mt-1 ml-5">{TIER_DESCRIPTIONS[tier]}</p>
            </div>
          ))}
        </div>
      </div>

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
              type="button"
              onClick={onClearSelection}
              className="mt-2 w-full px-3 py-2 text-xs border border-gray-500/50 rounded text-gray-400 hover:text-white hover:border-gray-400 transition-all"
            >
              Clear selection
            </button>
          </div>
        </div>
      )}

        {loading && (
          <div className="p-5 text-center text-gray-500 text-sm">Loading graph...</div>
        )}

        <div className="flex-1" />

        <div className="p-4 border-t border-gray-500/25">
          <p className="text-[12.8px] text-gray-600">
            Drag to rotate. Scroll to zoom. Click node to select.
          </p>
        </div>
      </div>
    </>
  );
}
