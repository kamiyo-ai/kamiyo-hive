"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { ActiveEffect, AgentName } from "@/types/agent-events";

const AGENT_POSITIONS: Record<AgentName, [number, number, number]> = {
  kamiyo: [0, 0, -3],
  oracle: [-3, 0, 1],
  sage: [3, 0, 1],
  chaos: [0, 0, 4],
};

interface DebateBeamProps {
  effect: ActiveEffect;
}

export function DebateBeam({ effect }: DebateBeamProps) {
  const ring1Ref = useRef<THREE.Mesh>(null);
  const ring2Ref = useRef<THREE.Mesh>(null);

  const position = effect.source ? AGENT_POSITIONS[effect.source] : [0, 0.5, 0];
  const color = new THREE.Color(effect.color);

  useFrame(() => {
    const p = effect.progress;

    if (ring1Ref.current) {
      const scale1 = 0.5 + p * 3;
      ring1Ref.current.scale.setScalar(scale1);
      const mat1 = ring1Ref.current.material as THREE.MeshBasicMaterial;
      mat1.opacity = Math.max(0, 1 - p);
    }

    if (ring2Ref.current) {
      const delayed = Math.max(0, p - 0.15);
      const scale2 = 0.3 + delayed * 2.5;
      ring2Ref.current.scale.setScalar(scale2);
      const mat2 = ring2Ref.current.material as THREE.MeshBasicMaterial;
      mat2.opacity = Math.max(0, 0.8 - delayed * 1.2);
    }
  });

  return (
    <group position={position as [number, number, number]}>
      {/* Outer thin ring */}
      <mesh ref={ring1Ref} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.9, 1.0, 48]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={1}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      {/* Inner thicker band, delayed */}
      <mesh ref={ring2Ref} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.6, 0.85, 48]} />
        <meshBasicMaterial
          color={color.clone().lerp(new THREE.Color("#ffffff"), 0.3)}
          transparent
          opacity={0.8}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}
