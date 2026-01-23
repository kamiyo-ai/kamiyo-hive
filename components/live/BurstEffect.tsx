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
  const ring1Ref = useRef<THREE.Mesh>(null);
  const ring2Ref = useRef<THREE.Mesh>(null);
  const ring3Ref = useRef<THREE.Mesh>(null);

  const position = effect.source ? AGENT_POSITIONS[effect.source] : [0, 0.5, 0];
  const color = new THREE.Color(effect.color);

  useFrame(() => {
    const p = effect.progress;

    // Ring 1: fast expanding thin ring
    if (ring1Ref.current) {
      const scale = 0.3 + p * 4;
      ring1Ref.current.scale.setScalar(scale);
      const mat = ring1Ref.current.material as THREE.MeshBasicMaterial;
      mat.opacity = Math.max(0, 1 - p * 1.2);
    }

    // Ring 2: medium band, slightly delayed
    if (ring2Ref.current) {
      const d = Math.max(0, p - 0.1);
      const scale = 0.2 + d * 3;
      ring2Ref.current.scale.setScalar(scale);
      const mat = ring2Ref.current.material as THREE.MeshBasicMaterial;
      mat.opacity = Math.max(0, 0.7 - d * 1.1);
    }

    // Ring 3: thick slow band, most delayed
    if (ring3Ref.current) {
      const d = Math.max(0, p - 0.25);
      const scale = 0.15 + d * 2;
      ring3Ref.current.scale.setScalar(scale);
      const mat = ring3Ref.current.material as THREE.MeshBasicMaterial;
      mat.opacity = Math.max(0, 0.5 - d * 1.0);
    }
  });

  return (
    <group position={position as [number, number, number]}>
      {/* Thin outer ring */}
      <mesh ref={ring1Ref} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.92, 1.0, 48]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={1}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      {/* Medium band */}
      <mesh ref={ring2Ref} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.7, 0.9, 48]} />
        <meshBasicMaterial
          color={color.clone().lerp(new THREE.Color("#ffffff"), 0.2)}
          transparent
          opacity={0.7}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      {/* Thick inner band */}
      <mesh ref={ring3Ref} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.4, 0.75, 48]} />
        <meshBasicMaterial
          color={color.clone().lerp(new THREE.Color("#000000"), 0.2)}
          transparent
          opacity={0.5}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}
