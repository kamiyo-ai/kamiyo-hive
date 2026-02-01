"use client";

import { useRef, useState, useCallback, useMemo, useEffect } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { AgentNode } from "../live/AgentNode";
import { TrustGraphHUD } from "./TrustGraphHUD";
import type { TrustNode, TrustEdge, TrustGraphStats, Tier } from "./types";
import { TIER_COLORS } from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://api.kamiyo.ai";

// Fallback mock data when API unavailable
const FALLBACK_NODES: TrustNode[] = [
  { id: "agent-001", label: "Kamiyo Prime", tier: "oracle", reputation: 95, txCount: 1247 },
  { id: "agent-002", label: "Data Fetcher", tier: "sentinel", reputation: 82, txCount: 856 },
  { id: "agent-003", label: "Price Bot", tier: "sentinel", reputation: 78, txCount: 423 },
  { id: "agent-004", label: "Arbitrage Scanner", tier: "architect", reputation: 65, txCount: 312 },
  { id: "agent-005", label: "Liquidity Monitor", tier: "architect", reputation: 58, txCount: 234 },
  { id: "agent-006", label: "Swap Executor", tier: "scout", reputation: 42, txCount: 156 },
  { id: "agent-007", label: "Alert Bot", tier: "scout", reputation: 35, txCount: 89 },
  { id: "agent-008", label: "Analytics Agent", tier: "oracle", reputation: 92, txCount: 2103 },
  { id: "agent-009", label: "Risk Assessor", tier: "sentinel", reputation: 76, txCount: 567 },
  { id: "agent-010", label: "Report Generator", tier: "architect", reputation: 54, txCount: 178 },
  { id: "agent-011", label: "New Agent", tier: "ghost", reputation: 12, txCount: 5 },
  { id: "agent-012", label: "Test Agent", tier: "ghost", reputation: 8, txCount: 2 },
];

const FALLBACK_EDGES: TrustEdge[] = [
  { source: "agent-001", target: "agent-002", weight: 85 },
  { source: "agent-001", target: "agent-008", weight: 92 },
  { source: "agent-002", target: "agent-003", weight: 72 },
  { source: "agent-002", target: "agent-004", weight: 58 },
  { source: "agent-003", target: "agent-006", weight: 45 },
  { source: "agent-004", target: "agent-005", weight: 63 },
  { source: "agent-005", target: "agent-006", weight: 38 },
  { source: "agent-006", target: "agent-007", weight: 32 },
  { source: "agent-008", target: "agent-009", weight: 78 },
  { source: "agent-008", target: "agent-002", weight: 81 },
  { source: "agent-009", target: "agent-010", weight: 55 },
  { source: "agent-009", target: "agent-004", weight: 48 },
  { source: "agent-010", target: "agent-007", weight: 28 },
  { source: "agent-001", target: "agent-009", weight: 70 },
  { source: "agent-003", target: "agent-005", weight: 52 },
  { source: "agent-011", target: "agent-006", weight: 15 },
  { source: "agent-012", target: "agent-011", weight: 10 },
];

interface TrustGraphResponse {
  nodes: TrustNode[];
  edges: TrustEdge[];
  stats: TrustGraphStats;
}

function useTrustGraph() {
  const [data, setData] = useState<TrustGraphResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchGraph() {
      try {
        const res = await fetch(`${API_URL}/api/trust-graph`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        setData(json);
        setError(null);
      } catch (err) {
        console.warn("[TrustGraph] API unavailable, using fallback data");
        setError(err instanceof Error ? err.message : "Unknown error");
        // Use fallback data
        setData({
          nodes: FALLBACK_NODES,
          edges: FALLBACK_EDGES,
          stats: computeStats(FALLBACK_NODES, FALLBACK_EDGES),
        });
      } finally {
        setLoading(false);
      }
    }
    fetchGraph();
  }, []);

  return { data, loading, error };
}

// Generate 3D positions using force-directed layout simulation
function generatePositions(nodes: TrustNode[], edges: TrustEdge[]): Map<string, [number, number, number]> {
  const positions = new Map<string, [number, number, number]>();
  const nodeCount = nodes.length;

  // Initial positions in a sphere
  nodes.forEach((node, i) => {
    const phi = Math.acos(-1 + (2 * i) / nodeCount);
    const theta = Math.sqrt(nodeCount * Math.PI) * phi;
    const r = 4 + Math.random();
    positions.set(node.id, [
      r * Math.cos(theta) * Math.sin(phi),
      (Math.random() - 0.5) * 2,
      r * Math.sin(theta) * Math.sin(phi),
    ]);
  });

  // Simple force simulation (10 iterations)
  for (let iter = 0; iter < 10; iter++) {
    // Repulsion between all nodes
    for (let i = 0; i < nodeCount; i++) {
      for (let j = i + 1; j < nodeCount; j++) {
        const posI = positions.get(nodes[i].id)!;
        const posJ = positions.get(nodes[j].id)!;
        const dx = posI[0] - posJ[0];
        const dy = posI[1] - posJ[1];
        const dz = posI[2] - posJ[2];
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) || 0.1;
        const force = 0.5 / (dist * dist);
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        const fz = (dz / dist) * force;
        positions.set(nodes[i].id, [posI[0] + fx, posI[1] + fy, posI[2] + fz]);
        positions.set(nodes[j].id, [posJ[0] - fx, posJ[1] - fy, posJ[2] - fz]);
      }
    }

    // Attraction along edges
    for (const edge of edges) {
      const posS = positions.get(edge.source);
      const posT = positions.get(edge.target);
      if (!posS || !posT) continue;
      const dx = posT[0] - posS[0];
      const dy = posT[1] - posS[1];
      const dz = posT[2] - posS[2];
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) || 0.1;
      const force = dist * 0.02 * (edge.weight / 100);
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      const fz = (dz / dist) * force;
      positions.set(edge.source, [posS[0] + fx, posS[1] + fy, posS[2] + fz]);
      positions.set(edge.target, [posT[0] - fx, posT[1] - fy, posT[2] - fz]);
    }
  }

  return positions;
}

function computeStats(nodes: TrustNode[], edges: TrustEdge[]): TrustGraphStats {
  const tierCounts: Record<Tier, number> = {
    oracle: 0,
    sentinel: 0,
    architect: 0,
    scout: 0,
    ghost: 0,
  };

  for (const node of nodes) {
    tierCounts[node.tier]++;
  }

  const avgTrust =
    edges.length > 0
      ? Math.round(edges.reduce((sum, e) => sum + e.weight, 0) / edges.length)
      : 0;

  return {
    totalNodes: nodes.length,
    totalEdges: edges.length,
    avgTrust,
    tierCounts,
  };
}

// Particle web connecting trust graph nodes
interface TrustParticleWebProps {
  nodes: TrustNode[];
  edges: TrustEdge[];
  positions: Map<string, [number, number, number]>;
  selectedNodeId: string | null;
  speakingNodes: Set<string>;
}

const NODES_PER_EDGE = 6;
const CONNECTION_DISTANCE = 2.0;
const WAVE_SPEED = 4;
const WAVE_RADIUS = 1.5;

interface ParticleNodeData {
  position: THREE.Vector3;
  basePosition: THREE.Vector3;
  excitation: number;
}

interface WaveData {
  sourceId: string;
  targetId: string;
  source: THREE.Vector3;
  target: THREE.Vector3;
  direction: THREE.Vector3;
  totalDist: number;
  startedAt: number;
}

function TrustParticleWeb({ nodes, edges, positions, selectedNodeId, speakingNodes }: TrustParticleWebProps) {
  const activeWaves = useRef<WaveData[]>([]);
  const lastWaveTime = useRef(0);

  // Generate particles along edges
  const particles = useMemo<ParticleNodeData[]>(() => {
    const result: ParticleNodeData[] = [];
    let seed = 42;

    const seededRandom = (s: number) => {
      const x = Math.sin(s * 9999) * 10000;
      return x - Math.floor(x);
    };

    for (const edge of edges) {
      const fromPos = positions.get(edge.source);
      const toPos = positions.get(edge.target);
      if (!fromPos || !toPos) continue;

      const from = new THREE.Vector3(...fromPos);
      const to = new THREE.Vector3(...toPos);
      const dist = from.distanceTo(to);
      const nodesForEdge = Math.max(3, Math.floor(NODES_PER_EDGE * (dist / 6)));

      for (let n = 1; n <= nodesForEdge; n++) {
        const t = n / (nodesForEdge + 1);
        const pos = from.clone().lerp(to, t);

        seed++;
        const offset = new THREE.Vector3(
          (seededRandom(seed) - 0.5) * 0.8,
          (seededRandom(seed + 100) - 0.5) * 0.6,
          (seededRandom(seed + 200) - 0.5) * 0.8
        );
        pos.add(offset);

        result.push({
          position: pos.clone(),
          basePosition: pos.clone(),
          excitation: 0,
        });
      }
    }

    return result;
  }, [edges, positions]);

  const nodeCount = particles.length;

  const pointsGeometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const positionsArr = new Float32Array(nodeCount * 3);
    const colors = new Float32Array(nodeCount * 3);
    geo.setAttribute("position", new THREE.BufferAttribute(positionsArr, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    return geo;
  }, [nodeCount]);

  const linesGeometry = useMemo(() => {
    const maxLines = (nodeCount * (nodeCount - 1)) / 2;
    const geo = new THREE.BufferGeometry();
    const positionsArr = new Float32Array(maxLines * 6);
    const colors = new Float32Array(maxLines * 6);
    geo.setAttribute("position", new THREE.BufferAttribute(positionsArr, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geo.setDrawRange(0, 0);
    return geo;
  }, [nodeCount]);

  useFrame((_, delta) => {
    const now = Date.now();

    // Start waves from speaking nodes
    if (now - lastWaveTime.current > 1500 && speakingNodes.size > 0) {
      lastWaveTime.current = now;
      const speakingArr = Array.from(speakingNodes);
      const sourceId = speakingArr[Math.floor(Math.random() * speakingArr.length)];
      const sourcePos = positions.get(sourceId);
      if (sourcePos) {
        // Find a connected target
        const connectedEdges = edges.filter(e => e.source === sourceId || e.target === sourceId);
        if (connectedEdges.length > 0) {
          const edge = connectedEdges[Math.floor(Math.random() * connectedEdges.length)];
          const targetId = edge.source === sourceId ? edge.target : edge.source;
          const targetPos = positions.get(targetId);
          if (targetPos) {
            const src = new THREE.Vector3(...sourcePos);
            const tgt = new THREE.Vector3(...targetPos);
            const dir = tgt.clone().sub(src).normalize();
            activeWaves.current.push({
              sourceId,
              targetId,
              source: src,
              target: tgt,
              direction: dir,
              totalDist: src.distanceTo(tgt),
              startedAt: now,
            });
          }
        }
      }
    }

    // Process waves
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

      for (const particle of particles) {
        const distToFront = particle.basePosition.distanceTo(waveFront);
        if (distToFront < WAVE_RADIUS) {
          const strength = (1 - distToFront / WAVE_RADIUS) * 0.9;
          particle.excitation = Math.min(1, particle.excitation + strength * delta * 12);
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
    const highlightColor = new THREE.Color("#00f0ff");

    // Update particles
    for (let i = 0; i < nodeCount; i++) {
      const particle = particles[i];
      particle.excitation = Math.max(0, particle.excitation - delta * 2.0);
      posAttr.setXYZ(i, particle.basePosition.x, particle.basePosition.y, particle.basePosition.z);
      const particleColor = baseColor.clone().lerp(waveColor, particle.excitation);
      colorAttr.setXYZ(i, particleColor.r, particleColor.g, particleColor.b);
    }
    posAttr.needsUpdate = true;
    colorAttr.needsUpdate = true;

    // Update connections
    let lineIndex = 0;
    for (let i = 0; i < nodeCount; i++) {
      for (let j = i + 1; j < nodeCount; j++) {
        const dist = particles[i].basePosition.distanceTo(particles[j].basePosition);
        if (dist < CONNECTION_DISTANCE) {
          const proximity = 1 - dist / CONNECTION_DISTANCE;
          const excitement = Math.max(particles[i].excitation, particles[j].excitation);
          const baseOpacity = 0.15;
          const blend = baseOpacity + excitement * (1 - baseOpacity);
          const color = dimColor.clone().lerp(waveColor, blend * proximity);

          linePositions.setXYZ(lineIndex * 2, particles[i].basePosition.x, particles[i].basePosition.y, particles[i].basePosition.z);
          linePositions.setXYZ(lineIndex * 2 + 1, particles[j].basePosition.x, particles[j].basePosition.y, particles[j].basePosition.z);
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
      <points geometry={pointsGeometry}>
        <pointsMaterial
          size={0.06}
          vertexColors
          transparent
          opacity={0.8}
          depthWrite={false}
          sizeAttenuation
        />
      </points>
      <lineSegments geometry={linesGeometry}>
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

function AutoOrbit() {
  const controlsRef = useRef<any>(null);
  const angleRef = useRef(0);
  const lastInteraction = useRef(0);
  const dragging = useRef(false);

  useFrame((_, delta) => {
    if (!controlsRef.current) return;

    const now = Date.now();
    const idle = now - lastInteraction.current > 3000;

    if (!dragging.current && idle) {
      if (lastInteraction.current > 0 && now - lastInteraction.current < 3200) {
        const cam = controlsRef.current.object.position;
        angleRef.current = Math.atan2(cam.x, cam.z);
      }

      angleRef.current += delta * 0.15;
      const radius = 10;
      const x = Math.sin(angleRef.current) * radius;
      const z = Math.cos(angleRef.current) * radius;

      controlsRef.current.object.position.lerp(
        new THREE.Vector3(x, 2, z),
        delta * 0.5
      );
      controlsRef.current.target.lerp(new THREE.Vector3(0, 0, 0), delta * 2);
      controlsRef.current.update();
    }
  });

  return (
    <OrbitControls
      ref={controlsRef}
      enableZoom={true}
      enablePan={false}
      minDistance={5}
      maxDistance={20}
      dampingFactor={0.05}
      onStart={() => {
        dragging.current = true;
        lastInteraction.current = Date.now();
      }}
      onEnd={() => {
        dragging.current = false;
        lastInteraction.current = Date.now();
      }}
    />
  );
}

interface SceneContentProps {
  nodes: TrustNode[];
  edges: TrustEdge[];
  positions: Map<string, [number, number, number]>;
  selectedNodeId: string | null;
  speakingNodes: Set<string>;
  onNodeClick: (node: TrustNode) => void;
}

function SceneContent({
  nodes,
  edges,
  positions,
  selectedNodeId,
  speakingNodes,
  onNodeClick,
}: SceneContentProps) {
  return (
    <>
      <ambientLight intensity={0.1} />
      <pointLight position={[0, 5, 0]} intensity={0.5} color="#00f0ff" />
      <pointLight position={[-4, 3, -2]} intensity={0.3} color="#ff44f5" />
      <pointLight position={[4, 3, 2]} intensity={0.2} color="#ffaa22" />

      <TrustParticleWeb
        nodes={nodes}
        edges={edges}
        positions={positions}
        selectedNodeId={selectedNodeId}
        speakingNodes={speakingNodes}
      />

      {nodes.map((node, i) => {
        const pos = positions.get(node.id);
        if (!pos) return null;
        const isSpeaking = speakingNodes.has(node.id);
        const isSelected = selectedNodeId === node.id;
        return (
          <group key={node.id} onClick={() => onNodeClick(node)}>
            <AgentNode
              name={node.id}
              state={{
                position: pos,
                color: TIER_COLORS[node.tier],
                intensity: isSelected ? 1 : 0.6,
                speaking: isSpeaking || isSelected,
                scale: 1,
              }}
              phaseOffset={i * 0.15}
            />
          </group>
        );
      })}

      <AutoOrbit />
    </>
  );
}

// Manage speaking simulation
function SpeakingManager({ nodes, setSpeakingNodes }: { nodes: TrustNode[]; setSpeakingNodes: React.Dispatch<React.SetStateAction<Set<string>>> }) {
  const lastSpeakTime = useRef(0);

  useFrame(() => {
    const now = Date.now();
    if (now - lastSpeakTime.current > 3000 + Math.random() * 2000) {
      lastSpeakTime.current = now;
      const randomNode = nodes[Math.floor(Math.random() * nodes.length)];
      if (randomNode) {
        setSpeakingNodes(prev => new Set(prev).add(randomNode.id));
        setTimeout(() => {
          setSpeakingNodes(prev => {
            const next = new Set(prev);
            next.delete(randomNode.id);
            return next;
          });
        }, 2500 + Math.random() * 1500);
      }
    }
  });

  return null;
}

export function TrustGraphScene() {
  const { data, loading } = useTrustGraph();
  const [selectedNode, setSelectedNode] = useState<TrustNode | null>(null);
  const [speakingNodes, setSpeakingNodes] = useState<Set<string>>(new Set());
  const [filterTier, setFilterTier] = useState<Tier | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");

  const nodes = data?.nodes ?? [];
  const edges = data?.edges ?? [];

  // Filter nodes
  const filteredNodes = useMemo(() => {
    let result = nodes;
    if (filterTier !== "all") {
      result = result.filter((n) => n.tier === filterTier);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (n) => n.id.toLowerCase().includes(q) || n.label.toLowerCase().includes(q)
      );
    }
    return result;
  }, [nodes, filterTier, searchQuery]);

  // Filter edges to only include visible nodes
  const filteredEdges = useMemo(() => {
    const nodeIds = new Set(filteredNodes.map((n) => n.id));
    return edges.filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target));
  }, [edges, filteredNodes]);

  // Generate positions
  const positions = useMemo(
    () => generatePositions(filteredNodes, filteredEdges),
    [filteredNodes, filteredEdges]
  );

  // Compute stats for filtered view
  const stats = useMemo(
    () => computeStats(filteredNodes, filteredEdges),
    [filteredNodes, filteredEdges]
  );

  const handleNodeClick = useCallback((node: TrustNode) => {
    setSelectedNode((prev) => (prev?.id === node.id ? null : node));
  }, []);

  const handleClearSelection = useCallback(() => {
    setSelectedNode(null);
  }, []);

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <Canvas
        camera={{ position: [0, 2, 10], fov: 50 }}
        style={{ background: "#000" }}
        gl={{ antialias: true, alpha: false }}
      >
        <SpeakingManager nodes={filteredNodes} setSpeakingNodes={setSpeakingNodes} />
        <SceneContent
          nodes={filteredNodes}
          edges={filteredEdges}
          positions={positions}
          selectedNodeId={selectedNode?.id ?? null}
          speakingNodes={speakingNodes}
          onNodeClick={handleNodeClick}
        />
      </Canvas>
      <TrustGraphHUD
        stats={stats}
        selectedNode={selectedNode}
        onSearch={setSearchQuery}
        onFilterTier={setFilterTier}
        onClearSelection={handleClearSelection}
        loading={loading}
      />
    </div>
  );
}
