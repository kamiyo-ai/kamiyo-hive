'use client';

import { Canvas } from '@react-three/fiber';
import type { SwarmMember, SwarmDraw } from '@/lib/swarm-api';
import { useSwarmVizState } from '@/hooks/useSwarmVizState';
import { SwarmNode } from './SwarmNode';
import { SwarmWeb } from './SwarmWeb';
import { DrawRing } from './DrawRing';
import { SlowDrift } from './SlowDrift';

interface SwarmBackgroundProps {
  members: SwarmMember[];
  draws: SwarmDraw[];
}

function SceneContent({ members, draws }: SwarmBackgroundProps) {
  const { positions, colors, activeAgents, effects, positionsArray } = useSwarmVizState(members, draws);

  return (
    <>
      <SlowDrift />
      <ambientLight intensity={0.1} />
      <pointLight position={[0, 5, 0]} color="#00f0ff" intensity={0.4} />
      <pointLight position={[-4, 3, -2]} color="#ff44f5" intensity={0.2} />

      <SwarmWeb positions={positionsArray} effects={effects} />

      {members.map((m) => {
        const pos = positions.get(m.agentId);
        const col = colors.get(m.agentId);
        if (!pos || !col) return null;
        return (
          <SwarmNode
            key={m.id}
            agentId={m.agentId}
            role={m.role}
            position={pos}
            color={col}
            active={activeAgents.has(m.agentId)}
          />
        );
      })}

      {effects.map((e) => (
        <DrawRing key={e.id} effect={e} />
      ))}
    </>
  );
}

export function SwarmBackground({ members, draws }: SwarmBackgroundProps) {
  if (members.length === 0) return null;

  return (
    <div className="fixed inset-0 z-0 pointer-events-none">
      <Canvas
        camera={{ position: [0, 5, 14], fov: 50 }}
        gl={{ alpha: true, antialias: true }}
        dpr={[1, 1.5]}
      >
        <SceneContent members={members} draws={draws} />
      </Canvas>
    </div>
  );
}
