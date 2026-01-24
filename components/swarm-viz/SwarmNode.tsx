'use client';

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';

const PARTICLE_COUNT = 56;
const CLOUD_RADIUS = 0.7;

interface SwarmNodeProps {
  agentId: string;
  role: string;
  position: [number, number, number];
  color: string;
  active: boolean;
}

export function SwarmNode({ agentId, role, position, color, active }: SwarmNodeProps) {
  const activation = useRef(0);
  const glowRef = useRef<THREE.Mesh>(null);

  const { geo, basePositions } = useMemo(() => {
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const colors = new Float32Array(PARTICLE_COUNT * 3);
    const bases: THREE.Vector3[] = [];

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 0.15 + Math.random() * (CLOUD_RADIUS - 0.15);
      const x = r * Math.sin(phi) * Math.cos(theta);
      const y = r * Math.sin(phi) * Math.sin(theta) * 0.6;
      const z = r * Math.cos(phi);
      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;
      bases.push(new THREE.Vector3(x, y, z));
    }

    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return { geo: g, basePositions: bases };
  }, []);

  useFrame((_, delta) => {
    const target = active ? 1 : 0.15;
    activation.current += (target - activation.current) * delta * 3;
    const a = activation.current;

    const c = new THREE.Color(color);
    const dim = new THREE.Color('#1a1a2e');
    const colorAttr = geo.getAttribute('color') as THREE.BufferAttribute;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const nodeColor = dim.clone().lerp(c, a);
      colorAttr.setXYZ(i, nodeColor.r, nodeColor.g, nodeColor.b);
    }
    colorAttr.needsUpdate = true;

    if (glowRef.current) {
      const mat = glowRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.2 + a * 0.4;
    }
  });

  return (
    <group position={position}>
      <points geometry={geo}>
        <pointsMaterial
          size={0.045}
          vertexColors
          transparent
          opacity={0.85}
          depthWrite={false}
          sizeAttenuation
        />
      </points>

      {/* Center glow */}
      <mesh ref={glowRef}>
        <sphereGeometry args={[0.08, 16, 16]} />
        <meshBasicMaterial color={color} transparent opacity={0.3} />
      </mesh>

      {/* Label */}
      <Html
        position={[0, -0.9, 0]}
        center
        distanceFactor={10}
        style={{ pointerEvents: 'none' }}
      >
        <div style={{
          fontFamily: "'Atkinson Hyperlegible Mono', monospace",
          fontSize: '10px',
          letterSpacing: '-0.3px',
          whiteSpace: 'nowrap',
          textAlign: 'center',
        }}>
          <div style={{ color: '#666', fontWeight: 300 }}>{agentId}</div>
          <div style={{ color: '#444', fontSize: '8px' }}>{role}</div>
        </div>
      </Html>
    </group>
  );
}
