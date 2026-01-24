"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { ActiveEffect } from "@/types/agent-events";

const NODES_PER_PATH = 12;
const CONNECTION_DISTANCE = 2.0;
const WAVE_SPEED = 6;
const WAVE_RADIUS = 1.8;

interface NodeData {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  basePosition: THREE.Vector3;
  excitation: number;
  excitationColor: THREE.Color;
}

interface WaveData {
  source: THREE.Vector3;
  target: THREE.Vector3;
  direction: THREE.Vector3;
  totalDist: number;
  color: THREE.Color;
  startedAt: number;
  effectId: string;
}

interface ParticleWebProps {
  effects: ActiveEffect[];
}

const AGENT_POSITIONS: Record<string, [number, number, number]> = {
  kamiyo: [0, 0, -3],
  oracle: [-3, 0, 1],
  sage: [3, 0, 1],
  chaos: [0, 0, 4],
};

const AGENT_NAMES = ["kamiyo", "oracle", "sage", "chaos"];

// Generate nodes distributed along paths between all agent pairs
function generateNodes(): NodeData[] {
  const nodes: NodeData[] = [];

  for (let i = 0; i < AGENT_NAMES.length; i++) {
    for (let j = i + 1; j < AGENT_NAMES.length; j++) {
      const from = new THREE.Vector3(...AGENT_POSITIONS[AGENT_NAMES[i]]);
      const to = new THREE.Vector3(...AGENT_POSITIONS[AGENT_NAMES[j]]);

      for (let n = 1; n <= NODES_PER_PATH; n++) {
        const t = n / (NODES_PER_PATH + 1);
        const pos = from.clone().lerp(to, t);
        // Add some random offset perpendicular to the path
        const offset = new THREE.Vector3(
          (Math.random() - 0.5) * 1.2,
          (Math.random() - 0.5) * 0.8,
          (Math.random() - 0.5) * 1.2
        );
        pos.add(offset);

        nodes.push({
          position: pos.clone(),
          velocity: new THREE.Vector3(0, 0, 0),
          basePosition: pos.clone(),
          excitation: 0,
          excitationColor: new THREE.Color("#00f0ff"),
        });
      }
    }
  }

  return nodes;
}

export function ParticleWeb({ effects }: ParticleWebProps) {
  const pointsRef = useRef<THREE.Points>(null);
  const linesRef = useRef<THREE.LineSegments>(null);
  const processedEffects = useRef<Set<string>>(new Set());
  const activeWaves = useRef<WaveData[]>([]);

  const nodes = useMemo<NodeData[]>(() => generateNodes(), []);
  const nodeCount = nodes.length;

  const pointsGeometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(nodeCount * 3);
    const colors = new Float32Array(nodeCount * 3);
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    return geo;
  }, [nodeCount]);

  const linesGeometry = useMemo(() => {
    const maxLines = (nodeCount * (nodeCount - 1)) / 2;
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(maxLines * 6);
    const colors = new Float32Array(maxLines * 6);
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geo.setDrawRange(0, 0);
    return geo;
  }, [nodeCount]);

  useFrame((_, delta) => {
    const now = Date.now();

    // Detect new effects and spawn waves
    for (const effect of effects) {
      if (processedEffects.current.has(effect.id)) continue;
      processedEffects.current.add(effect.id);

      const sourceName = effect.source || "kamiyo";
      const targetName = effect.target || (sourceName === "kamiyo" ? "oracle" : "kamiyo");

      const sourcePos = AGENT_POSITIONS[sourceName];
      const targetPos = AGENT_POSITIONS[targetName];
      if (!sourcePos || !targetPos) continue;

      const src = new THREE.Vector3(...sourcePos);
      const tgt = new THREE.Vector3(...targetPos);
      const dir = tgt.clone().sub(src).normalize();
      const totalDist = src.distanceTo(tgt);

      activeWaves.current.push({
        source: src,
        target: tgt,
        direction: dir,
        totalDist,
        color: new THREE.Color(effect.color),
        startedAt: now,
        effectId: effect.id,
      });
    }

    // Clean up old processed IDs
    if (processedEffects.current.size > 150) {
      const arr = Array.from(processedEffects.current);
      processedEffects.current = new Set(arr.slice(arr.length - 100));
    }

    // Process active waves
    const expiredWaves: number[] = [];
    for (let w = 0; w < activeWaves.current.length; w++) {
      const wave = activeWaves.current[w];
      const elapsed = (now - wave.startedAt) / 1000;
      const waveFrontDist = elapsed * WAVE_SPEED;

      if (waveFrontDist > wave.totalDist + WAVE_RADIUS * 2) {
        expiredWaves.push(w);
        continue;
      }

      // Wave front position along source->target
      const waveFront = wave.source.clone().add(
        wave.direction.clone().multiplyScalar(Math.min(waveFrontDist, wave.totalDist))
      );

      for (const node of nodes) {
        const distToFront = node.basePosition.distanceTo(waveFront);
        if (distToFront < WAVE_RADIUS) {
          const strength = (1 - distToFront / WAVE_RADIUS) * 0.7;
          node.excitation = Math.min(1, node.excitation + strength * delta * 12);
          node.excitationColor.copy(wave.color);
        }
      }
    }

    for (let i = expiredWaves.length - 1; i >= 0; i--) {
      activeWaves.current.splice(expiredWaves[i], 1);
    }

    const posAttr = pointsGeometry.getAttribute("position") as THREE.BufferAttribute;
    const colorAttr = pointsGeometry.getAttribute("color") as THREE.BufferAttribute;
    const linePositions = linesGeometry.getAttribute("position") as THREE.BufferAttribute;
    const lineColors = linesGeometry.getAttribute("color") as THREE.BufferAttribute;

    const baseColor = new THREE.Color("#1a1a2e");
    const dimColor = new THREE.Color("#0d0d1a");

    // Update nodes
    for (let i = 0; i < nodeCount; i++) {
      const node = nodes[i];

      // Decay excitation
      node.excitation = Math.max(0, node.excitation - delta * 1.5);

      posAttr.setXYZ(i, node.basePosition.x, node.basePosition.y, node.basePosition.z);

      const nodeColor = baseColor.clone().lerp(node.excitationColor, node.excitation);
      colorAttr.setXYZ(i, nodeColor.r, nodeColor.g, nodeColor.b);
    }
    posAttr.needsUpdate = true;
    colorAttr.needsUpdate = true;

    // Update connections
    let lineIndex = 0;

    for (let i = 0; i < nodeCount; i++) {
      for (let j = i + 1; j < nodeCount; j++) {
        const dist = nodes[i].basePosition.distanceTo(nodes[j].basePosition);
        if (dist < CONNECTION_DISTANCE) {
          const proximity = 1 - dist / CONNECTION_DISTANCE;
          const excitement = Math.max(nodes[i].excitation, nodes[j].excitation);
          const excitedNode = nodes[i].excitation > nodes[j].excitation ? nodes[i] : nodes[j];
          // Show dim lines at rest, bright on excitation
          const baseOpacity = 0.15;
          const blend = baseOpacity + excitement * (1 - baseOpacity);
          const color = dimColor.clone().lerp(excitedNode.excitationColor, blend * proximity);

          linePositions.setXYZ(lineIndex * 2, nodes[i].basePosition.x, nodes[i].basePosition.y, nodes[i].basePosition.z);
          linePositions.setXYZ(lineIndex * 2 + 1, nodes[j].basePosition.x, nodes[j].basePosition.y, nodes[j].basePosition.z);

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

  return (
    <>
      <points ref={pointsRef} geometry={pointsGeometry}>
        <pointsMaterial
          size={0.06}
          vertexColors
          transparent
          opacity={0.8}
          depthWrite={false}
          sizeAttenuation
        />
      </points>
      <lineSegments ref={linesRef} geometry={linesGeometry}>
        <lineBasicMaterial
          vertexColors
          transparent
          opacity={0.35}
          depthWrite={false}
        />
      </lineSegments>
    </>
  );
}
