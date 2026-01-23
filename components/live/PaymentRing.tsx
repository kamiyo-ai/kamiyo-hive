"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { ActiveEffect } from "@/types/agent-events";

interface PaymentRingProps {
  effect: ActiveEffect;
}

export function PaymentRing({ effect }: PaymentRingProps) {
  const groupRef = useRef<THREE.Group>(null);
  const color = new THREE.Color(effect.color);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    groupRef.current.rotation.y += delta * 2;

    const p = effect.progress;
    // Expand then contract
    const scale = p < 0.5 ? p * 2 * 3 : (1 - p) * 2 * 3;
    groupRef.current.scale.setScalar(Math.max(0.01, scale));

    groupRef.current.children.forEach((child) => {
      const mat = (child as THREE.Mesh).material as THREE.MeshBasicMaterial;
      if (mat) mat.opacity = Math.max(0, 1 - p);
    });
  });

  // 6 hexagonal segments
  const segments = Array.from({ length: 6 }, (_, i) => {
    const angle = (i / 6) * Math.PI * 2;
    const x = Math.cos(angle) * 2;
    const z = Math.sin(angle) * 2;
    return [x, 0, z] as [number, number, number];
  });

  return (
    <group ref={groupRef} position={[0, 0.5, 0]}>
      {segments.map((pos, i) => (
        <mesh key={i} position={pos} rotation={[Math.PI / 2, 0, (i / 6) * Math.PI * 2]}>
          <circleGeometry args={[0.3, 6]} />
          <meshBasicMaterial
            color={color}
            transparent
            opacity={0.8}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  );
}
