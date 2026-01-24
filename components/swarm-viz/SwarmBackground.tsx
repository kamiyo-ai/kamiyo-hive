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

function Scene({ members, draws }: SwarmBackgroundProps) {
  const { agents, effects, positions } = useSwarmVizState(members, draws);

  return (
    <>
      <SlowDrift />
      <ambientLight intensity={0.1} />
      <pointLight position={[-8, 6, -4]} color="#00f0ff" intensity={0.4} />
      <pointLight position={[8, 4, 4]} color="#ff44f5" intensity={0.3} />

      <SwarmWeb positions={positions} effects={effects} />

      {agents.map((agent) => (
        <SwarmNode
          key={agent.memberId}
          agentId={agent.agentId}
          role={agent.role}
          position={agent.position}
          color={agent.color}
          active={agent.active}
        />
      ))}

      {effects.map((e) => (
        <DrawRing key={e.id} effect={e} />
      ))}
    </>
  );
}

export function SwarmBackground({ members, draws }: SwarmBackgroundProps) {
  return (
    <div className="fixed inset-0 z-0 pointer-events-none">
      <Canvas
        camera={{ position: [0, 5, 14], fov: 50 }}
        gl={{ alpha: true }}
        dpr={[1, 1.5]}
        style={{ background: 'transparent' }}
      >
        <Scene members={members} draws={draws} />
      </Canvas>
    </div>
  );
}
