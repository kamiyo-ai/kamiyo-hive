import { useMemo, useRef, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import type { SwarmMember, SwarmDraw } from '@/lib/swarm-api';
import type { SwarmVizEffect } from '@/types/swarm-viz';

const COLORS = ['#00f0ff', '#9944ff', '#ff44f5', '#ffaa22', '#00ff88', '#ff6644'];
const EFFECT_DURATION = 2500;
const ACTIVE_WINDOW = 30_000; // 30s

function computePositions(count: number): [number, number, number][] {
  if (count === 0) return [];
  if (count === 1) return [[0, 0, 0]];
  const radius = Math.max(3, count * 0.8);
  return Array.from({ length: count }, (_, i) => {
    const angle = (2 * Math.PI * i) / count;
    return [
      radius * Math.cos(angle),
      0,
      radius * Math.sin(angle),
    ] as [number, number, number];
  });
}

export interface SwarmVizState {
  positions: Map<string, [number, number, number]>;
  colors: Map<string, string>;
  activeAgents: Set<string>;
  effects: SwarmVizEffect[];
  positionsArray: [number, number, number][];
}

export function useSwarmVizState(members: SwarmMember[], draws: SwarmDraw[]) {
  const prevDrawIdsRef = useRef<Set<string>>(new Set());
  const effectsRef = useRef<SwarmVizEffect[]>([]);

  const { positions, colors, positionsArray } = useMemo(() => {
    const posArr = computePositions(members.length);
    const posMap = new Map<string, [number, number, number]>();
    const colMap = new Map<string, string>();

    members.forEach((m, i) => {
      posMap.set(m.agentId, posArr[i]);
      colMap.set(m.agentId, COLORS[i % COLORS.length]);
    });

    return { positions: posMap, colors: colMap, positionsArray: posArr };
  }, [members]);

  const activeAgents = useMemo(() => {
    const now = Date.now();
    const active = new Set<string>();
    for (const d of draws) {
      if (now - d.createdAt < ACTIVE_WINDOW) {
        active.add(d.agentId);
      }
    }
    return active;
  }, [draws]);

  // Detect new draws and spawn effects
  const spawnNewEffects = useCallback(() => {
    const currentIds = new Set(draws.map(d => d.id));
    const newDraws = draws.filter(d => !prevDrawIdsRef.current.has(d.id));

    for (const draw of newDraws) {
      const pos = positions.get(draw.agentId);
      if (!pos) continue;

      effectsRef.current.push({
        id: draw.id,
        type: 'ring',
        sourcePosition: pos,
        color: draw.blindfoldStatus === 'completed' ? '#00ff88' : '#ffaa22',
        progress: 0,
        startedAt: Date.now(),
        duration: EFFECT_DURATION,
      });
    }

    prevDrawIdsRef.current = currentIds;
  }, [draws, positions]);

  // Advance effects each frame
  useFrame(() => {
    spawnNewEffects();

    const now = Date.now();
    effectsRef.current = effectsRef.current.filter(e => {
      e.progress = Math.min(1, (now - e.startedAt) / e.duration);
      return e.progress < 1;
    });
  });

  return {
    positions,
    colors,
    activeAgents,
    effects: effectsRef.current,
    positionsArray,
  };
}
