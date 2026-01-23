"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { ActiveEffect } from "@/types/agent-events";

interface PaymentRingProps {
  effect: ActiveEffect;
}

export function PaymentRing({ effect }: PaymentRingProps) {
  const ring1Ref = useRef<THREE.Mesh>(null);
  const ring2Ref = useRef<THREE.Mesh>(null);

  const color = new THREE.Color(effect.color);

  useFrame(() => {
    const p = effect.progress;

    // Ring 1: expands then fades
    if (ring1Ref.current) {
      const scale = p < 0.5 ? p * 2 * 3 : 3;
      ring1Ref.current.scale.setScalar(Math.max(0.01, scale));
      const mat = ring1Ref.current.material as THREE.MeshBasicMaterial;
      mat.opacity = Math.max(0, 1 - p);
    }

    // Ring 2: thinner, delayed pulse
    if (ring2Ref.current) {
      const d = Math.max(0, p - 0.2);
      const scale = d < 0.4 ? (d / 0.4) * 2.5 : 2.5;
      ring2Ref.current.scale.setScalar(Math.max(0.01, scale));
      const mat = ring2Ref.current.material as THREE.MeshBasicMaterial;
      mat.opacity = Math.max(0, 0.8 - d * 1.5);
    }
  });

  return (
    <group position={[0, 0.5, 0]}>
      {/* Primary ring */}
      <mesh ref={ring1Ref} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.85, 1.0, 48]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={1}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      {/* Secondary thin ring */}
      <mesh ref={ring2Ref} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.93, 1.0, 48]} />
        <meshBasicMaterial
          color={color.clone().lerp(new THREE.Color("#ffffff"), 0.5)}
          transparent
          opacity={0.8}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}
