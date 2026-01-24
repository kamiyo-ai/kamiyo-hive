'use client';

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { SwarmVizEffect } from '@/types/swarm-viz';

const NODES_PER_PATH = 8;
const MAX_NODES = 64;
const CONNECTION_DISTANCE = 2.2;
const WAVE_SPEED = 5;
const WAVE_RADIUS = 2.0;

interface NodeData {
  position: THREE.Vector3;
  basePosition: THREE.Vector3;
  excitation: number;
  excitationColor: THREE.Color;
}

interface SwarmWebProps {
  positions: [number, number, number][];
  effects: SwarmVizEffect[];
}

function generateNodes(agentPositions: [number, number, number][]): NodeData[] {
  const nodes: NodeData[] = [];
  const n = agentPositions.length;
  if (n < 2) return nodes;

  // For small teams, connect all pairs. For large, only adjacent + some diagonals.
  const pairs: [number, number][] = [];
  if (n <= 5) {
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        pairs.push([i, j]);
      }
    }
  } else {
    for (let i = 0; i < n; i++) {
      pairs.push([i, (i + 1) % n]);
      if (n > 4) pairs.push([i, (i + 2) % n]);
    }
  }

  const nodesPerPair = Math.min(NODES_PER_PATH, Math.floor(MAX_NODES / Math.max(1, pairs.length)));

  for (const [a, b] of pairs) {
    if (nodes.length >= MAX_NODES) break;
    const from = new THREE.Vector3(...agentPositions[a]);
    const to = new THREE.Vector3(...agentPositions[b]);

    for (let k = 1; k <= nodesPerPair; k++) {
      if (nodes.length >= MAX_NODES) break;
      const t = k / (nodesPerPair + 1);
      const pos = from.clone().lerp(to, t);
      pos.x += (Math.random() - 0.5) * 1.0;
      pos.y += (Math.random() - 0.5) * 0.6;
      pos.z += (Math.random() - 0.5) * 1.0;

      nodes.push({
        position: pos.clone(),
        basePosition: pos.clone(),
        excitation: 0,
        excitationColor: new THREE.Color('#00f0ff'),
      });
    }
  }

  return nodes;
}

export function SwarmWeb({ positions, effects }: SwarmWebProps) {
  const processedEffects = useRef<Set<string>>(new Set());

  const nodes = useMemo(() => generateNodes(positions), [positions]);
  const nodeCount = nodes.length;

  const pointsGeo = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(nodeCount * 3), 3));
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(nodeCount * 3), 3));
    return geo;
  }, [nodeCount]);

  const linesGeo = useMemo(() => {
    const maxLines = (nodeCount * (nodeCount - 1)) / 2;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(maxLines * 6), 3));
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(maxLines * 6), 3));
    geo.setDrawRange(0, 0);
    return geo;
  }, [nodeCount]);

  useFrame((_, delta) => {
    if (nodeCount === 0) return;

    // Excite nodes near new effect sources
    for (const effect of effects) {
      if (processedEffects.current.has(effect.id)) continue;
      processedEffects.current.add(effect.id);

      const src = new THREE.Vector3(...effect.sourcePosition);
      for (const node of nodes) {
        const dist = node.basePosition.distanceTo(src);
        if (dist < WAVE_RADIUS) {
          const strength = (1 - dist / WAVE_RADIUS) * 0.8;
          node.excitation = Math.min(1, node.excitation + strength);
          node.excitationColor.set(effect.color);
        }
      }
    }

    // Cap processed set
    if (processedEffects.current.size > 100) {
      const arr = Array.from(processedEffects.current);
      processedEffects.current = new Set(arr.slice(-50));
    }

    const baseColor = new THREE.Color('#1a1a2e');
    const dimLine = new THREE.Color('#0d0d1a');

    const posAttr = pointsGeo.getAttribute('position') as THREE.BufferAttribute;
    const colorAttr = pointsGeo.getAttribute('color') as THREE.BufferAttribute;
    const linePos = linesGeo.getAttribute('position') as THREE.BufferAttribute;
    const lineCol = linesGeo.getAttribute('color') as THREE.BufferAttribute;

    for (let i = 0; i < nodeCount; i++) {
      const node = nodes[i];
      node.excitation = Math.max(0, node.excitation - delta * 1.2);

      posAttr.setXYZ(i, node.basePosition.x, node.basePosition.y, node.basePosition.z);
      const c = baseColor.clone().lerp(node.excitationColor, node.excitation);
      colorAttr.setXYZ(i, c.r, c.g, c.b);
    }
    posAttr.needsUpdate = true;
    colorAttr.needsUpdate = true;

    let lineIndex = 0;
    for (let i = 0; i < nodeCount; i++) {
      for (let j = i + 1; j < nodeCount; j++) {
        const dist = nodes[i].basePosition.distanceTo(nodes[j].basePosition);
        if (dist < CONNECTION_DISTANCE) {
          const proximity = 1 - dist / CONNECTION_DISTANCE;
          const excitement = Math.max(nodes[i].excitation, nodes[j].excitation);
          const excitedNode = nodes[i].excitation > nodes[j].excitation ? nodes[i] : nodes[j];
          const blend = 0.12 + excitement * 0.88;
          const c = dimLine.clone().lerp(excitedNode.excitationColor, blend * proximity);

          linePos.setXYZ(lineIndex * 2, nodes[i].basePosition.x, nodes[i].basePosition.y, nodes[i].basePosition.z);
          linePos.setXYZ(lineIndex * 2 + 1, nodes[j].basePosition.x, nodes[j].basePosition.y, nodes[j].basePosition.z);
          lineCol.setXYZ(lineIndex * 2, c.r, c.g, c.b);
          lineCol.setXYZ(lineIndex * 2 + 1, c.r, c.g, c.b);
          lineIndex++;
        }
      }
    }
    linePos.needsUpdate = true;
    lineCol.needsUpdate = true;
    linesGeo.setDrawRange(0, lineIndex * 2);
  });

  if (nodeCount === 0) return null;

  return (
    <>
      <points geometry={pointsGeo}>
        <pointsMaterial
          size={0.05}
          vertexColors
          transparent
          opacity={0.7}
          depthWrite={false}
          sizeAttenuation
        />
      </points>
      <lineSegments geometry={linesGeo}>
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
