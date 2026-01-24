'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { SwarmVizEffect } from '@/types/swarm-viz';

interface DrawRingProps {
  effect: SwarmVizEffect;
}

export function DrawRing({ effect }: DrawRingProps) {
  const ring1 = useRef<THREE.Mesh>(null);
  const ring2 = useRef<THREE.Mesh>(null);

  const color = new THREE.Color(effect.color);

  useFrame(() => {
    const p = effect.progress;

    if (ring1.current) {
      const scale = 0.3 + p * 3;
      ring1.current.scale.setScalar(scale);
      const mat = ring1.current.material as THREE.MeshBasicMaterial;
      mat.opacity = Math.max(0, 1 - p * 1.2);
    }

    if (ring2.current) {
      const delayed = Math.max(0, p - 0.15);
      const scale = 0.3 + delayed * 2.5;
      ring2.current.scale.setScalar(scale);
      const mat = ring2.current.material as THREE.MeshBasicMaterial;
      mat.opacity = Math.max(0, 0.7 - delayed * 1.4);
    }
  });

  return (
    <group position={effect.sourcePosition}>
      <mesh ref={ring1} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.8, 0.95, 48]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={1}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      <mesh ref={ring2} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.88, 0.95, 48]} />
        <meshBasicMaterial
          color={color.clone().lerp(new THREE.Color('#ffffff'), 0.4)}
          transparent
          opacity={0.7}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}
