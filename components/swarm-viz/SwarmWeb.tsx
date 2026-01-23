'use client';

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { SwarmVizEffect } from '@/types/swarm-viz';

const NODES_PER_PATH = 8;
const CONNECTION_DISTANCE = 2.0;
const WAVE_SPEED = 5;
const WAVE_RADIUS = 1.6;
const MAX_PATHS = 8;

interface NodeData {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  basePosition: THREE.Vector3;
  excitation: number;
  excitationColor: THREE.Color;
}

interface WaveData {
  source: THREE.Vector3;
  direction: THREE.Vector3;
  totalDist: number;
  color: THREE.Color;
  startedAt: number;
  effectId: string;
}

interface SwarmWebProps {
  positions: [number, number, number][];
  effects: SwarmVizEffect[];
}

function generateConnections(count: number): [number, number][] {
  if (count <= 1) return [];
  // Adjacent pairs in circle + cross-connections
  const pairs: [number, number][] = [];
  for (let i = 0; i < count; i++) {
    pairs.push([i, (i + 1) % count]);
    if (count > 3) {
      pairs.push([i, (i + Math.floor(count / 2)) % count]);
    }
  }
  // Deduplicate
  const seen = new Set<string>();
  return pairs.filter(([a, b]) => {
    const key = `${Math.min(a, b)}-${Math.max(a, b)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, MAX_PATHS);
}

function generateNodes(positions: [number, number, number][]): NodeData[] {
  const connections = generateConnections(positions.length);
  const nodes: NodeData[] = [];

  for (const [i, j] of connections) {
    const from = new THREE.Vector3(...positions[i]);
    const to = new THREE.Vector3(...positions[j]);

    for (let n = 1; n <= NODES_PER_PATH; n++) {
      const t = n / (NODES_PER_PATH + 1);
      const pos = from.clone().lerp(to, t);
      pos.add(new THREE.Vector3(
        (Math.random() - 0.5) * 1.0,
        (Math.random() - 0.5) * 0.6,
        (Math.random() - 0.5) * 1.0,
      ));

      nodes.push({
        position: pos.clone(),
        velocity: new THREE.Vector3(0, 0, 0),
        basePosition: pos.clone(),
        excitation: 0,
        excitationColor: new THREE.Color('#00f0ff'),
      });
    }
  }

  return nodes;
}

export function SwarmWeb({ positions, effects }: SwarmWebProps) {
  const pointsRef = useRef<THREE.Points>(null);
  const linesRef = useRef<THREE.LineSegments>(null);
  const processedEffects = useRef<Set<string>>(new Set());
  const activeWaves = useRef<WaveData[]>([]);

  // Regenerate nodes when positions change
  const posKey = positions.map(p => p.join(',')).join('|');
  const nodes = useMemo<NodeData[]>(() => generateNodes(positions), [posKey]);
  const nodeCount = nodes.length;

  const pointsGeometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(nodeCount * 3);
    const col = new Float32Array(nodeCount * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return geo;
  }, [nodeCount]);

  const linesGeometry = useMemo(() => {
    const maxLines = (nodeCount * (nodeCount - 1)) / 2;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(maxLines * 6);
    const col = new Float32Array(maxLines * 6);
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setDrawRange(0, 0);
    return geo;
  }, [nodeCount]);

  useFrame((_, delta) => {
    const now = Date.now();

    // Spawn waves from new effects
    for (const effect of effects) {
      if (processedEffects.current.has(effect.id)) continue;
      processedEffects.current.add(effect.id);

      const src = new THREE.Vector3(...effect.sourcePosition);
      // Radial wave from source
      const center = new THREE.Vector3(0, 0, 0);
      const dir = center.clone().sub(src);
      const totalDist = dir.length() || 1;
      dir.normalize();

      activeWaves.current.push({
        source: src,
        direction: dir,
        totalDist: totalDist * 2, // travel past center
        color: new THREE.Color(effect.color),
        startedAt: now,
        effectId: effect.id,
      });
    }

    // Trim processed set
    if (processedEffects.current.size > 100) {
      const arr = Array.from(processedEffects.current);
      processedEffects.current = new Set(arr.slice(arr.length - 60));
    }

    // Process waves
    const expired: number[] = [];
    for (let w = 0; w < activeWaves.current.length; w++) {
      const wave = activeWaves.current[w];
      const elapsed = (now - wave.startedAt) / 1000;
      const waveFrontDist = elapsed * WAVE_SPEED;

      if (waveFrontDist > wave.totalDist + WAVE_RADIUS * 2) {
        expired.push(w);
        continue;
      }

      const waveFront = wave.source.clone().add(
        wave.direction.clone().multiplyScalar(Math.min(waveFrontDist, wave.totalDist))
      );

      for (const node of nodes) {
        const distToFront = node.position.distanceTo(waveFront);
        if (distToFront < WAVE_RADIUS) {
          const strength = (1 - distToFront / WAVE_RADIUS) * 0.6;
          node.excitation = Math.min(1, node.excitation + strength * delta * 10);
          node.excitationColor.copy(wave.color);
          node.velocity.add(wave.direction.clone().multiplyScalar(strength * 0.03));
        }
      }
    }

    for (let i = expired.length - 1; i >= 0; i--) {
      activeWaves.current.splice(expired[i], 1);
    }

    // Update node physics
    const posAttr = pointsGeometry.getAttribute('position') as THREE.BufferAttribute;
    const colorAttr = pointsGeometry.getAttribute('color') as THREE.BufferAttribute;
    const linePositions = linesGeometry.getAttribute('position') as THREE.BufferAttribute;
    const lineColors = linesGeometry.getAttribute('color') as THREE.BufferAttribute;

    const baseColor = new THREE.Color('#1a1a2e');
    const dimColor = new THREE.Color('#0d0d1a');

    for (let i = 0; i < nodeCount; i++) {
      const node = nodes[i];

      const toBase = node.basePosition.clone().sub(node.position);
      node.velocity.add(toBase.multiplyScalar(0.005));
      node.velocity.multiplyScalar(0.94);
      node.excitation = Math.max(0, node.excitation - delta * 1.5);
      node.position.add(node.velocity.clone().multiplyScalar(delta * 60));

      posAttr.setXYZ(i, node.position.x, node.position.y, node.position.z);
      const c = baseColor.clone().lerp(node.excitationColor, node.excitation);
      colorAttr.setXYZ(i, c.r, c.g, c.b);
    }
    posAttr.needsUpdate = true;
    colorAttr.needsUpdate = true;

    // Update line connections
    let lineIndex = 0;
    for (let i = 0; i < nodeCount; i++) {
      for (let j = i + 1; j < nodeCount; j++) {
        const dist = nodes[i].position.distanceTo(nodes[j].position);
        if (dist < CONNECTION_DISTANCE) {
          const proximity = 1 - dist / CONNECTION_DISTANCE;
          const excitement = Math.max(nodes[i].excitation, nodes[j].excitation);
          const excitedNode = nodes[i].excitation > nodes[j].excitation ? nodes[i] : nodes[j];
          const blend = 0.12 + excitement * 0.88;
          const color = dimColor.clone().lerp(excitedNode.excitationColor, blend * proximity);

          linePositions.setXYZ(lineIndex * 2, nodes[i].position.x, nodes[i].position.y, nodes[i].position.z);
          linePositions.setXYZ(lineIndex * 2 + 1, nodes[j].position.x, nodes[j].position.y, nodes[j].position.z);
          lineColors.setXYZ(lineIndex * 2, color.r, color.g, color.b);
          lineColors.setXYZ(lineIndex * 2 + 1, color.r, color.g, color.b);
          lineIndex++;
        }
      }
    }

    linePositions.needsUpdate = true;
    lineColors.needsUpdate = true;
    linesGeometry.setDrawRange(0, lineIndex * 2);
  });

  if (nodeCount === 0) return null;

  return (
    <>
      <points ref={pointsRef} geometry={pointsGeometry}>
        <pointsMaterial
          size={0.05}
          vertexColors
          transparent
          opacity={0.7}
          depthWrite={false}
          sizeAttenuation
        />
      </points>
      <lineSegments ref={linesRef} geometry={linesGeometry}>
        <lineBasicMaterial
          vertexColors
          transparent
          opacity={0.3}
          depthWrite={false}
        />
      </lineSegments>
    </>
  );
}
