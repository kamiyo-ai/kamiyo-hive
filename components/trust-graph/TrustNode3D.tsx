"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { TrustNode, Tier } from "./types";
import { TIER_COLORS, TIER_GLOW } from "./types";

interface TrustNode3DProps {
  node: TrustNode;
  position: [number, number, number];
  selected?: boolean;
  hovered?: boolean;
  onClick?: () => void;
  onHover?: (hovered: boolean) => void;
}

const PARTICLE_COUNT = 12;

export function TrustNode3D({
  node,
  position,
  selected = false,
  hovered = false,
  onClick,
  onHover,
}: TrustNode3DProps) {
  const groupRef = useRef<THREE.Group>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const particlesRef = useRef<THREE.Points>(null);

  const baseSize = 0.3 + (node.reputation / 100) * 0.3;
  const color = TIER_COLORS[node.tier];
  const glowColor = TIER_GLOW[node.tier];

  // Particle geometry for node halo
  const particleGeo = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const phases = new Float32Array(PARTICLE_COUNT);

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const theta = (i / PARTICLE_COUNT) * Math.PI * 2;
      const r = baseSize * 1.5;
      positions[i * 3] = Math.cos(theta) * r;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 0.2;
      positions[i * 3 + 2] = Math.sin(theta) * r;
      phases[i] = Math.random() * Math.PI * 2;
    }

    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("phase", new THREE.BufferAttribute(phases, 1));
    return geo;
  }, [baseSize]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;

    // Gentle floating motion
    const time = Date.now() * 0.001;
    groupRef.current.position.y = position[1] + Math.sin(time * 0.5) * 0.05;

    // Glow pulse
    if (glowRef.current) {
      const pulse = 1 + Math.sin(time * 2) * 0.1;
      const scale = selected ? 1.8 : hovered ? 1.5 : 1.2;
      glowRef.current.scale.setScalar(baseSize * scale * pulse);
    }

    // Rotate particles
    if (particlesRef.current) {
      particlesRef.current.rotation.y += delta * 0.3;
    }
  });

  return (
    <group
      ref={groupRef}
      position={position}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      onPointerEnter={() => onHover?.(true)}
      onPointerLeave={() => onHover?.(false)}
    >
      {/* Core sphere */}
      <mesh>
        <sphereGeometry args={[baseSize, 32, 32]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={selected ? 0.8 : hovered ? 0.5 : 0.3}
          roughness={0.3}
          metalness={0.7}
        />
      </mesh>

      {/* Outer glow */}
      <mesh ref={glowRef}>
        <sphereGeometry args={[1, 16, 16]} />
        <meshBasicMaterial
          color={glowColor}
          transparent
          opacity={selected ? 0.25 : hovered ? 0.15 : 0.08}
          depthWrite={false}
        />
      </mesh>

      {/* Orbital particles */}
      <points ref={particlesRef} geometry={particleGeo}>
        <pointsMaterial
          size={0.04}
          color={color}
          transparent
          opacity={0.6}
          depthWrite={false}
          sizeAttenuation
        />
      </points>

      {/* Selection ring */}
      {selected && (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[baseSize * 1.8, baseSize * 2, 32]} />
          <meshBasicMaterial
            color={glowColor}
            transparent
            opacity={0.5}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      )}
    </group>
  );
}
