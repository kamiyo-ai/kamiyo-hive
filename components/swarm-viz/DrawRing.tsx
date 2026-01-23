'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { SwarmVizEffect } from '@/types/swarm-viz';

interface DrawRingProps {
  effect: SwarmVizEffect;
}

export function DrawRing({ effect }: DrawRingProps) {
  const ring1Ref = useRef<THREE.Mesh>(null);
  const ring2Ref = useRef<THREE.Mesh>(null);

  const color = new THREE.Color(effect.color);

  useFrame(() => {
    const p = effect.progress;

    if (ring1Ref.current) {
      const scale = 0.3 + p * 3;
      ring1Ref.current.scale.setScalar(Math.max(0.01, scale));
      const mat = ring1Ref.current.material as THREE.MeshBasicMaterial;
      mat.opacity = Math.max(0, 1 - p);
    }

    if (ring2Ref.current) {
      const d = Math.max(0, p - 0.15);
      const scale = 0.2 + d * 2.5;
      ring2Ref.current.scale.setScalar(Math.max(0.01, scale));
      const mat = ring2Ref.current.material as THREE.MeshBasicMaterial;
      mat.opacity = Math.max(0, 0.8 - d * 1.5);
    }
  });

  return (
    <group position={effect.sourcePosition}>
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
      <mesh ref={ring2Ref} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.93, 1.0, 48]} />
        <meshBasicMaterial
          color={color.clone().lerp(new THREE.Color('#ffffff'), 0.4)}
          transparent
          opacity={0.8}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}
