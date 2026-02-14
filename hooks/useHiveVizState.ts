import { useRef, useState, useCallback, useEffect } from 'react';
import type { HiveMember, HiveDraw } from '@/lib/hive-api';
import type { HiveVizEffect } from '@/types/hive-viz';

const COLORS = ['#00f0ff', '#9944ff', '#ff44f5', '#ffaa22', '#00ff88', '#ff6644'];
const RING_DURATION = 1800; // ms
const ACTIVE_WINDOW = 30_000; // 30s

interface AgentVizState {
  memberId: string;
  agentId: string;
  role: string;
  position: [number, number, number];
  color: string;
  active: boolean;
}

function computePositions(count: number): [number, number, number][] {
  const radius = Math.max(3, count * 0.8);
  return Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
    return [
      Math.cos(angle) * radius,
      0,
      Math.sin(angle) * radius,
    ] as [number, number, number];
  });
}

export function useHiveVizState(members: HiveMember[], draws: HiveDraw[]) {
  const prevDrawIds = useRef<Set<string>>(new Set());
  const [effects, setEffects] = useState<HiveVizEffect[]>([]);
  const animRef = useRef<number>(0);

  const positions = computePositions(members.length);

  const agents: AgentVizState[] = members.map((m, i) => {
    const recentDraw = draws.some(
      (d) => d.agentId === m.agentId && Date.now() - d.createdAt < ACTIVE_WINDOW
    );
    return {
      memberId: m.id,
      agentId: m.agentId,
      role: m.role,
      position: positions[i] || [0, 0, 0],
      color: COLORS[i % COLORS.length],
      active: recentDraw,
    };
  });

  // Detect new draws and spawn ring effects
  useEffect(() => {
    const currentIds = new Set(draws.map((d) => d.id));
    const newDraws = draws.filter((d) => !prevDrawIds.current.has(d.id));

    if (newDraws.length > 0 && prevDrawIds.current.size > 0) {
      const newEffects: HiveVizEffect[] = newDraws.map((draw) => {
        const agentIndex = members.findIndex((m) => m.agentId === draw.agentId);
        const pos = positions[agentIndex] || [0, 0, 0];
        const color = draw.status === 'completed' ? '#00ff88' : '#ffaa22';
        return {
          id: draw.id,
          type: 'ring' as const,
          sourcePosition: pos,
          color,
          progress: 0,
          startedAt: Date.now(),
          duration: RING_DURATION,
        };
      });
      setEffects((prev) => [...prev, ...newEffects]);
    }

    prevDrawIds.current = currentIds;
  }, [draws, members, positions]);

  // Advance effect progress, remove expired
  const tick = useCallback(() => {
    setEffects((prev) => {
      const now = Date.now();
      const updated: HiveVizEffect[] = [];
      for (const e of prev) {
        const elapsed = now - e.startedAt;
        if (elapsed >= e.duration) continue;
        updated.push({ ...e, progress: elapsed / e.duration });
      }
      return updated;
    });
    animRef.current = requestAnimationFrame(tick);
  }, []);

  useEffect(() => {
    animRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animRef.current);
  }, [tick]);

  return { agents, effects, positions };
}
