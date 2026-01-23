'use client';

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';

const SWARM_COUNT = 56;
const SWARM_RADIUS = 0.6;

interface SwarmNodeProps {
  agentId: string;
  role: string;
  position: [number, number, number];
  color: string;
  active: boolean;
}

function ParticleSwarm({ color, active }: { color: string; active: boolean }) {
  const nodesRef = useRef<THREE.Points>(null);

  const seeds = useMemo(() => {
    return Array.from({ length: SWARM_COUNT }, () => ({
      phase: Math.random() * Math.PI * 2,
      speed: 0.5 + Math.random() * 2.5,
      radiusX: 0.2 + Math.random() * SWARM_RADIUS,
      radiusY: 0.15 + Math.random() * 0.4,
      radiusZ: 0.2 + Math.random() * SWARM_RADIUS,
      offsetX: (Math.random() - 0.5) * 0.3,
      offsetY: (Math.random() - 0.5) * 0.2,
      offsetZ: (Math.random() - 0.5) * 0.3,
      freqX: 0.5 + Math.random() * 2,
      freqY: 0.3 + Math.random() * 1.5,
      freqZ: 0.4 + Math.random() * 2,
    }));
  }, []);

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(SWARM_COUNT * 3);
    const colors = new Float32Array(SWARM_COUNT * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return geo;
  }, []);

  useFrame(() => {
    const posAttr = geometry.getAttribute('position') as THREE.BufferAttribute;
    const colorAttr = geometry.getAttribute('color') as THREE.BufferAttribute;
    const c = new THREE.Color(color);
    const dim = new THREE.Color('#1a1a2e');
    const now = Date.now() * 0.001;

    for (let i = 0; i < SWARM_COUNT; i++) {
      const s = seeds[i];
      const t = now * s.speed + s.phase;
      const x = Math.sin(t * s.freqX) * s.radiusX + s.offsetX;
      const y = Math.cos(t * s.freqY) * s.radiusY + s.offsetY;
      const z = Math.sin(t * s.freqZ + 1.3) * s.radiusZ + s.offsetZ;
      posAttr.setXYZ(i, x, y, z);

      const nodeColor = active ? c : dim;
      colorAttr.setXYZ(i, nodeColor.r, nodeColor.g, nodeColor.b);
    }
    posAttr.needsUpdate = true;
    colorAttr.needsUpdate = true;
  });

  return (
    <points ref={nodesRef} geometry={geometry}>
      <pointsMaterial
        size={0.04}
        vertexColors
        transparent
        opacity={active ? 0.9 : 0.25}
        depthWrite={false}
        sizeAttenuation
      />
    </points>
  );
}

export function SwarmNode({ agentId, role, position, color, active }: SwarmNodeProps) {
  return (
    <group position={position}>
      <ParticleSwarm color={color} active={active} />

      {/* Glow core */}
      <mesh>
        <sphereGeometry args={[0.06, 16, 16]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={active ? 0.8 : 0.3}
        />
      </mesh>

      {/* Label */}
      <Html
        position={[0, -0.4, 0]}
        center
        distanceFactor={8}
        style={{ pointerEvents: 'none' }}
      >
        <div
          style={{
            fontFamily: "'Atkinson Hyperlegible Mono', monospace",
            fontSize: '10px',
            letterSpacing: '-0.3px',
            textTransform: 'uppercase',
            whiteSpace: 'nowrap',
          }}
        >
          <span style={{ fontWeight: 300, color: active ? color : '#555' }}>
            {agentId}
          </span>
          <span style={{ fontWeight: 200, color: '#333', marginLeft: 4 }}>
            {role}
          </span>
        </div>
      </Html>
    </group>
  );
}
