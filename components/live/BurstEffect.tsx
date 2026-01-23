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

interface BurstEffectProps {
  effect: ActiveEffect;
}

export function BurstEffect({ effect }: BurstEffectProps) {
  const meshRef = useRef<THREE.Mesh>(null);

  const position = effect.source ? AGENT_POSITIONS[effect.source] : [0, 0.5, 0];
  const color = new THREE.Color(effect.color);

  useFrame(() => {
    if (!meshRef.current) return;
    const p = effect.progress;
    const scale = p * 4;
    meshRef.current.scale.setScalar(scale);
    const mat = meshRef.current.material as THREE.MeshBasicMaterial;
    mat.opacity = Math.max(0, 1 - p);
  });

  return (
    <mesh ref={meshRef} position={position as [number, number, number]}>
      <ringGeometry args={[0.8, 1.0, 32]} />
      <meshBasicMaterial
        color={color}
        transparent
        opacity={1}
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  );
}
