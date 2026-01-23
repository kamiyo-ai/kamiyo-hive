"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { ActiveEffect } from "@/types/agent-events";

interface SpiralEffectProps {
  effect: ActiveEffect;
}

export function SpiralEffect({ effect }: SpiralEffectProps) {
  const pointsRef = useRef<THREE.Points>(null);
  const color = new THREE.Color(effect.color);

  const geometry = useMemo(() => {
    const positions = new Float32Array(60 * 3);
    for (let i = 0; i < 60; i++) {
      const t = i / 60;
      const angle = t * Math.PI * 6;
      const radius = 0.3 + t * 0.8;
      const y = t * 2 - 1;
      positions[i * 3] = Math.cos(angle) * radius;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = Math.sin(angle) * radius;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return geo;
  }, []);

  useFrame((_, delta) => {
    if (!pointsRef.current) return;
    pointsRef.current.rotation.y += delta * 4;

    const p = effect.progress;
    // Tight spiral that bursts outward at the end
    const scale = p < 0.7 ? 0.5 + p * 0.5 : 0.5 + p * 2;
    pointsRef.current.scale.setScalar(scale);

    const mat = pointsRef.current.material as THREE.PointsMaterial;
    mat.opacity = p < 0.8 ? 1 : Math.max(0, (1 - p) * 5);
  });

  return (
    <points ref={pointsRef} position={[0, 0.5, 0]} geometry={geometry}>
      <pointsMaterial
        color={color}
        size={0.08}
        transparent
        opacity={1}
        depthWrite={false}
        sizeAttenuation
      />
    </points>
  );
}
