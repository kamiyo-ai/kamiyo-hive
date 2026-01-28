"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

const NODES_PER_PATH = 10;
const CONNECTION_DISTANCE = 2.8;
const WAVE_SPEED = 5;
const WAVE_RADIUS = 2.0;

// Seeded random for consistent regeneration
function seededRandom(seed: number) {
  const x = Math.sin(seed * 9999) * 10000;
  return x - Math.floor(x);
}

interface NodeData {
  position: THREE.Vector3;
  basePosition: THREE.Vector3;
  excitation: number;
}

interface WaveData {
  sourceIdx: number;
  targetIdx: number;
  source: THREE.Vector3;
  target: THREE.Vector3;
  direction: THREE.Vector3;
  totalDist: number;
  startedAt: number;
}

interface AgentPosition {
  id: string;
  position: [number, number, number];
  color: string;
}

// All 7 agents
const ALL_AGENTS: AgentPosition[] = [
  { id: "kamiyo", position: [0, 0, -3.6], color: "#00f0ff" },
  { id: "oracle", position: [-3.6, 0, 1.2], color: "#9944ff" },
  { id: "sage", position: [3.6, 0, 1.2], color: "#ffaa22" },
  { id: "chaos", position: [0, 0, 4.8], color: "#ff44f5" },
  { id: "agent-5", position: [-5, 1.2, -4], color: "#00f0ff" },
  { id: "agent-6", position: [5, -0.8, -2], color: "#ff44f5" },
  { id: "agent-7", position: [-4, 1.5, 4], color: "#22ff88" },
];

// Generate nodes distributed along paths between nearby agent pairs
function generateNodes(): NodeData[] {
  const nodes: NodeData[] = [];
  const maxDistance = 12;
  let seed = 42;

  for (let i = 0; i < ALL_AGENTS.length; i++) {
    for (let j = i + 1; j < ALL_AGENTS.length; j++) {
      const from = new THREE.Vector3(...ALL_AGENTS[i].position);
      const to = new THREE.Vector3(...ALL_AGENTS[j].position);
      const dist = from.distanceTo(to);

      if (dist > maxDistance) continue;

      const nodesForPath = Math.max(5, Math.floor(NODES_PER_PATH * (dist / 8)));

      for (let n = 1; n <= nodesForPath; n++) {
        const t = n / (nodesForPath + 1);
        const pos = from.clone().lerp(to, t);

        seed++;
        const offset = new THREE.Vector3(
          (seededRandom(seed) - 0.5) * 1.4,
          (seededRandom(seed + 100) - 0.5) * 1.0,
          (seededRandom(seed + 200) - 0.5) * 1.4
        );
        pos.add(offset);

        nodes.push({
          position: pos.clone(),
          basePosition: pos.clone(),
          excitation: 0,
        });
      }
    }
  }

  return nodes;
}

interface ParticleWebProps {
  speakingAgents: Set<number>;
  onAgentReceive?: (idx: number) => void;
}

export function ParticleWeb({ speakingAgents, onAgentReceive }: ParticleWebProps) {
  const pointsRef = useRef<THREE.Points>(null);
  const linesRef = useRef<THREE.LineSegments>(null);
  const activeWaves = useRef<WaveData[]>([]);
  const lastWaveTime = useRef(0);
  const conversationState = useRef<{ phase: 'idle' | 'sending' | 'cooldown'; sourceIdx: number; targetIdx: number; startTime: number }>({
    phase: 'idle',
    sourceIdx: 0,
    targetIdx: 1,
    startTime: 0,
  });

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
    const conv = conversationState.current;

    // Conversation state machine
    if (conv.phase === 'idle') {
      // Start new conversation after delay
      if (now - conv.startTime > 2000 + Math.random() * 2000) {
        // Pick source from speaking agents or random
        const speakingArr = Array.from(speakingAgents);
        const sourceIdx = speakingArr.length > 0
          ? speakingArr[Math.floor(Math.random() * speakingArr.length)]
          : Math.floor(Math.random() * ALL_AGENTS.length);

        let targetIdx = Math.floor(Math.random() * ALL_AGENTS.length);
        while (targetIdx === sourceIdx) {
          targetIdx = Math.floor(Math.random() * ALL_AGENTS.length);
        }

        const src = new THREE.Vector3(...ALL_AGENTS[sourceIdx].position);
        const tgt = new THREE.Vector3(...ALL_AGENTS[targetIdx].position);
        const dir = tgt.clone().sub(src).normalize();
        const totalDist = src.distanceTo(tgt);

        activeWaves.current.push({
          sourceIdx,
          targetIdx,
          source: src,
          target: tgt,
          direction: dir,
          totalDist,
          startedAt: now,
        });

        conv.phase = 'sending';
        conv.sourceIdx = sourceIdx;
        conv.targetIdx = targetIdx;
        conv.startTime = now;
      }
    } else if (conv.phase === 'sending') {
      // Check if wave reached target
      const wave = activeWaves.current.find(w => w.sourceIdx === conv.sourceIdx && w.targetIdx === conv.targetIdx);
      if (wave) {
        const elapsed = (now - wave.startedAt) / 1000;
        const waveFrontDist = elapsed * WAVE_SPEED;
        if (waveFrontDist >= wave.totalDist) {
          // Wave arrived - notify target agent
          if (onAgentReceive) {
            onAgentReceive(conv.targetIdx);
          }
          conv.phase = 'cooldown';
          conv.startTime = now;
        }
      } else {
        conv.phase = 'idle';
        conv.startTime = now;
      }
    } else if (conv.phase === 'cooldown') {
      // Short pause before next conversation
      if (now - conv.startTime > 800 + Math.random() * 1200) {
        conv.phase = 'idle';
        conv.startTime = now;
      }
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

      const waveFront = wave.source.clone().add(
        wave.direction.clone().multiplyScalar(Math.min(waveFrontDist, wave.totalDist))
      );

      for (const node of nodes) {
        const distToFront = node.basePosition.distanceTo(waveFront);
        if (distToFront < WAVE_RADIUS) {
          const strength = (1 - distToFront / WAVE_RADIUS) * 0.9;
          node.excitation = Math.min(1, node.excitation + strength * delta * 12);
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

    const baseColor = new THREE.Color("#0a4050");
    const dimColor = new THREE.Color("#082838");
    const waveColor = new THREE.Color("#ffffff");

    // Update nodes
    for (let i = 0; i < nodeCount; i++) {
      const node = nodes[i];
      node.excitation = Math.max(0, node.excitation - delta * 2.0);
      posAttr.setXYZ(i, node.basePosition.x, node.basePosition.y, node.basePosition.z);
      const nodeColor = baseColor.clone().lerp(waveColor, node.excitation);
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
          const baseOpacity = 0.15;
          const blend = baseOpacity + excitement * (1 - baseOpacity);
          const color = dimColor.clone().lerp(waveColor, blend * proximity);

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
          opacity={0.4}
          depthWrite={false}
        />
      </lineSegments>
    </>
  );
}

export { ALL_AGENTS };
