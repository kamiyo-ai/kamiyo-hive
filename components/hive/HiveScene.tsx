"use client";

import { useRef, useMemo, useState, useEffect } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Html } from "@react-three/drei";
import * as THREE from "three";

interface HiveMember {
  id: string;
  agentId: string;
  role: string;
}

interface HiveSceneProps {
  members: HiveMember[];
}

const MEMBER_ICONS = [
  "/icons/icon-settlement.svg",
  "/icons/icon-oracle.svg",
  "/icons/icon-agreement.svg",
  "/icons/icon-delivered.svg",
  "/icons/icon-morphing.svg",
];

const MEMBER_COLORS = [
  "#00f0ff", // cyan
  "#9944ff", // purple
  "#ff44f5", // magenta
  "#ffaa22", // orange
  "#44ff88", // green
];

function useSvgTexture(url: string): THREE.Texture | null {
  const [texture, setTexture] = useState<THREE.Texture | null>(null);

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 128;
      canvas.height = 128;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(img, 0, 0, 128, 128);
        const tex = new THREE.CanvasTexture(canvas);
        tex.needsUpdate = true;
        setTexture(tex);
      }
    };
    img.src = url;

    return () => {
      if (texture) texture.dispose();
    };
  }, [url]);

  return texture;
}

function getMemberPosition(index: number, total: number): [number, number, number] {
  if (total === 0) return [0, 0, 0];
  const angle = (index / total) * Math.PI * 2 - Math.PI / 2;
  const radius = 3;
  return [Math.cos(angle) * radius, 0, Math.sin(angle) * radius];
}

const NODE_COUNT = 120;
const CONNECTION_DISTANCE = 2.5;

interface NodeData {
  position: THREE.Vector3;
  basePosition: THREE.Vector3;
  velocity: THREE.Vector3;
  phase: number;
  speed: number;
}

function generateNodes(memberPositions: [number, number, number][]): NodeData[] {
  const nodes: NodeData[] = [];

  if (memberPositions.length === 0) {
    // Generate scattered nodes in a larger sphere when no members
    for (let i = 0; i < NODE_COUNT; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 2 + Math.random() * 5;
      const pos = new THREE.Vector3(
        r * Math.sin(phi) * Math.cos(theta),
        (Math.random() - 0.5) * 4,
        r * Math.sin(phi) * Math.sin(theta)
      );
      nodes.push({
        position: pos.clone(),
        basePosition: pos.clone(),
        velocity: new THREE.Vector3(),
        phase: Math.random() * Math.PI * 2,
        speed: 0.2 + Math.random() * 0.4,
      });
    }
    return nodes;
  }

  // Generate nodes along paths between members
  const nodesPerPair = Math.max(4, Math.floor(NODE_COUNT / Math.max(1, memberPositions.length * (memberPositions.length - 1) / 2)));

  for (let i = 0; i < memberPositions.length; i++) {
    for (let j = i + 1; j < memberPositions.length; j++) {
      const from = new THREE.Vector3(...memberPositions[i]);
      const to = new THREE.Vector3(...memberPositions[j]);

      for (let n = 1; n <= nodesPerPair; n++) {
        const t = n / (nodesPerPair + 1);
        const pos = from.clone().lerp(to, t);
        const offset = new THREE.Vector3(
          (Math.random() - 0.5) * 1.2,
          (Math.random() - 0.5) * 0.8,
          (Math.random() - 0.5) * 1.2
        );
        pos.add(offset);

        nodes.push({
          position: pos.clone(),
          basePosition: pos.clone(),
          velocity: new THREE.Vector3(),
          phase: Math.random() * Math.PI * 2,
          speed: 0.2 + Math.random() * 0.4,
        });
      }
    }
  }

  // Add some scattered nodes around the center
  const remaining = NODE_COUNT - nodes.length;
  for (let i = 0; i < remaining; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const r = 1 + Math.random() * 5;
    const pos = new THREE.Vector3(
      r * Math.sin(phi) * Math.cos(theta),
      (Math.random() - 0.5) * 3,
      r * Math.sin(phi) * Math.sin(theta)
    );
    nodes.push({
      position: pos.clone(),
      basePosition: pos.clone(),
      velocity: new THREE.Vector3(),
      phase: Math.random() * Math.PI * 2,
      speed: 0.2 + Math.random() * 0.4,
    });
  }

  return nodes;
}

function HiveWeb({ memberPositions }: { memberPositions: [number, number, number][] }) {
  const nodesRef = useRef<NodeData[] | null>(null);

  const nodeCount = NODE_COUNT;

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

  // Initialize or regenerate nodes when member positions change
  const posKey = JSON.stringify(memberPositions);
  const lastPosKey = useRef("");
  if (lastPosKey.current !== posKey) {
    nodesRef.current = generateNodes(memberPositions);
    lastPosKey.current = posKey;
  }

  useFrame((_, delta) => {
    const nodes = nodesRef.current;
    if (!nodes) return;

    const now = Date.now() * 0.001;
    const baseColor = new THREE.Color("#1a1a2e");
    const accentColor = new THREE.Color("#00f0ff");
    const dimColor = new THREE.Color("#0d0d1a");

    const posAttr = pointsGeometry.getAttribute("position") as THREE.BufferAttribute;
    const colorAttr = pointsGeometry.getAttribute("color") as THREE.BufferAttribute;
    const linePositions = linesGeometry.getAttribute("position") as THREE.BufferAttribute;
    const lineColors = linesGeometry.getAttribute("color") as THREE.BufferAttribute;

    // Update node positions with gentle drift
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      const drift = Math.sin(now * node.speed + node.phase) * 0.1;
      const px = node.basePosition.x + drift;
      const py = node.basePosition.y + Math.cos(now * node.speed * 0.7 + node.phase) * 0.05;
      const pz = node.basePosition.z + Math.sin(now * node.speed * 1.2 + node.phase + 1) * 0.1;

      node.position.set(px, py, pz);
      posAttr.setXYZ(i, px, py, pz);
      colorAttr.setXYZ(i, baseColor.r, baseColor.g, baseColor.b);
    }
    posAttr.needsUpdate = true;
    colorAttr.needsUpdate = true;

    // Update connections
    let lineIndex = 0;
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dist = nodes[i].position.distanceTo(nodes[j].position);
        if (dist < CONNECTION_DISTANCE) {
          const proximity = 1 - dist / CONNECTION_DISTANCE;
          const color = dimColor.clone().lerp(accentColor, proximity * 0.3);

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

  return (
    <>
      <points geometry={pointsGeometry}>
        <pointsMaterial
          size={0.05}
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
          opacity={0.35}
          depthWrite={false}
        />
      </lineSegments>
    </>
  );
}

const AGENT_NODE_COUNT = 16;
const AGENT_WEB_RADIUS = 1.1;
const AGENT_CONNECTION_DIST = 1.2;

interface MiniNodeData {
  position: THREE.Vector3;
  basePosition: THREE.Vector3;
  phase: number;
  speed: number;
  drift: THREE.Vector3;
}

function AgentWeb({ color, active }: { color: string; active: boolean }) {
  const nodesRef = useRef<MiniNodeData[] | null>(null);

  const pointsGeo = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(AGENT_NODE_COUNT * 3), 3));
    geo.setAttribute("color", new THREE.BufferAttribute(new Float32Array(AGENT_NODE_COUNT * 3), 3));
    return geo;
  }, []);

  const linesGeo = useMemo(() => {
    const maxLines = (AGENT_NODE_COUNT * (AGENT_NODE_COUNT - 1)) / 2;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(maxLines * 6), 3));
    geo.setAttribute("color", new THREE.BufferAttribute(new Float32Array(maxLines * 6), 3));
    geo.setDrawRange(0, 0);
    return geo;
  }, []);

  // Initialize nodes in a sphere around origin
  if (!nodesRef.current) {
    nodesRef.current = Array.from({ length: AGENT_NODE_COUNT }, () => {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 0.6 + Math.random() * (AGENT_WEB_RADIUS - 0.6);
      const pos = new THREE.Vector3(
        r * Math.sin(phi) * Math.cos(theta),
        r * Math.sin(phi) * Math.sin(theta),
        r * Math.cos(phi)
      );
      return {
        position: pos.clone(),
        basePosition: pos.clone(),
        phase: Math.random() * Math.PI * 2,
        speed: 0.3 + Math.random() * 0.8,
        drift: new THREE.Vector3(
          (Math.random() - 0.5) * 0.15,
          (Math.random() - 0.5) * 0.1,
          (Math.random() - 0.5) * 0.15
        ),
      };
    });
  }

  // Smoothly interpolate activation for transitions
  const activation = useRef(0);

  useFrame((_, delta) => {
    const nodes = nodesRef.current!;
    const now = Date.now() * 0.001;
    const c = new THREE.Color(color);
    const restColor = new THREE.Color("#0a3040");
    const dimLine = new THREE.Color("#082830");

    // Smooth activation transition
    const targetActivation = active ? 1 : 0;
    activation.current += (targetActivation - activation.current) * delta * 4;
    const a = activation.current;

    const posAttr = pointsGeo.getAttribute("position") as THREE.BufferAttribute;
    const colorAttr = pointsGeo.getAttribute("color") as THREE.BufferAttribute;
    const linePos = linesGeo.getAttribute("position") as THREE.BufferAttribute;
    const lineCol = linesGeo.getAttribute("color") as THREE.BufferAttribute;

    for (let i = 0; i < AGENT_NODE_COUNT; i++) {
      const node = nodes[i];
      const px = node.basePosition.x + a * Math.sin(now * node.speed + node.phase) * node.drift.x * 4;
      const py = node.basePosition.y + a * Math.cos(now * node.speed * 0.7 + node.phase) * node.drift.y * 4;
      const pz = node.basePosition.z + a * Math.sin(now * node.speed * 1.3 + node.phase + 1) * node.drift.z * 4;
      node.position.set(px, py, pz);
      posAttr.setXYZ(i, px, py, pz);
      const nodeColor = restColor.clone().lerp(c, a);
      colorAttr.setXYZ(i, nodeColor.r, nodeColor.g, nodeColor.b);
    }
    posAttr.needsUpdate = true;
    colorAttr.needsUpdate = true;

    // Draw connections
    let lineIndex = 0;
    for (let i = 0; i < AGENT_NODE_COUNT; i++) {
      for (let j = i + 1; j < AGENT_NODE_COUNT; j++) {
        const dist = nodes[i].position.distanceTo(nodes[j].position);
        if (dist < AGENT_CONNECTION_DIST) {
          const proximity = 1 - dist / AGENT_CONNECTION_DIST;
          const lineColor = dimLine.clone().lerp(c, proximity * a * 0.85);

          linePos.setXYZ(lineIndex * 2, nodes[i].position.x, nodes[i].position.y, nodes[i].position.z);
          linePos.setXYZ(lineIndex * 2 + 1, nodes[j].position.x, nodes[j].position.y, nodes[j].position.z);
          lineCol.setXYZ(lineIndex * 2, lineColor.r, lineColor.g, lineColor.b);
          lineCol.setXYZ(lineIndex * 2 + 1, lineColor.r, lineColor.g, lineColor.b);
          lineIndex++;
        }
      }
    }
    linePos.needsUpdate = true;
    lineCol.needsUpdate = true;
    linesGeo.setDrawRange(0, lineIndex * 2);
  });

  return (
    <group>
      <points geometry={pointsGeo}>
        <pointsMaterial
          size={0.04}
          vertexColors
          transparent
          opacity={0.9}
          depthWrite={false}
          sizeAttenuation
        />
      </points>
      <lineSegments geometry={linesGeo}>
        <lineBasicMaterial
          vertexColors
          transparent
          opacity={0.7}
          depthWrite={false}
        />
      </lineSegments>
    </group>
  );
}

function MemberNode({
  member,
  position,
  iconIndex,
  isLatest
}: {
  member: HiveMember;
  position: [number, number, number];
  iconIndex: number;
  isLatest: boolean;
}) {
  const iconTexture = useSvgTexture(MEMBER_ICONS[iconIndex % MEMBER_ICONS.length]);
  const color = MEMBER_COLORS[iconIndex % MEMBER_COLORS.length];

  return (
    <group position={position}>
      {/* Mini web around agent */}
      <AgentWeb color={color} active={isLatest} />

      {/* Icon sprite */}
      {iconTexture && (
        <sprite scale={[0.22, 0.22, 1]}>
          <spriteMaterial
            map={iconTexture}
            transparent
            opacity={0.95}
            depthTest={false}
          />
        </sprite>
      )}

      {/* Label */}
      <Html
        position={[0, -0.3, 0]}
        center
        distanceFactor={8}
        zIndexRange={[1, 5]}
        style={{ pointerEvents: "none" }}
      >
        <div
          style={{
            fontFamily: "'Atkinson Hyperlegible Mono', monospace",
            fontSize: "11px",
            letterSpacing: "-0.5px",
            textTransform: "uppercase",
            whiteSpace: "nowrap",
            transition: "color 0.3s",
          }}
        >
          <span style={{ fontWeight: 200, color: "#444", marginRight: 4 }}>
            {member.role === "admin" ? "ADMIN" : "AGENT"}
          </span>
          <span style={{ fontWeight: 300, color: isLatest ? "#ffffff" : "#666" }}>
            {member.agentId.slice(0, 8)}
          </span>
        </div>
      </Html>
    </group>
  );
}

function AutoOrbit() {
  const controlsRef = useRef<any>(null);
  const angleRef = useRef(0);
  const dragging = useRef(false);
  const lastInteraction = useRef(0);

  useFrame((_, delta) => {
    if (!controlsRef.current) return;

    const now = Date.now();
    const idle = now - lastInteraction.current > 3000;

    if (!dragging.current && idle) {
      if (lastInteraction.current > 0 && now - lastInteraction.current < 3200) {
        const cam = controlsRef.current.object.position;
        angleRef.current = Math.atan2(cam.x, cam.z);
      }

      angleRef.current += delta * 0.1;
      const radius = 12;
      const x = Math.sin(angleRef.current) * radius;
      const z = Math.cos(angleRef.current) * radius;

      controlsRef.current.object.position.lerp(
        new THREE.Vector3(x, 5, z),
        delta * 0.5
      );
      controlsRef.current.target.lerp(
        new THREE.Vector3(0, 0, 0),
        delta * 2
      );
      controlsRef.current.update();
    }
  });

  return (
    <OrbitControls
      ref={controlsRef}
      enableZoom={true}
      enablePan={false}
      minDistance={4}
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

function SceneContent({ members }: { members: HiveMember[] }) {
  const memberPositions = useMemo(() => {
    return members.map((_, i) => getMemberPosition(i, members.length));
  }, [members]);

  return (
    <>
      <ambientLight intensity={0.1} />
      <pointLight position={[0, 5, 0]} intensity={0.4} color="#00f0ff" />
      <pointLight position={[-4, 3, -2]} intensity={0.2} color="#ff44f5" />
      <pointLight position={[4, 3, 2]} intensity={0.15} color="#ffaa22" />

      <HiveWeb memberPositions={memberPositions} />

      {members.map((member, i) => (
        <MemberNode
          key={member.id}
          member={member}
          position={memberPositions[i]}
          iconIndex={i}
          isLatest={i === members.length - 1}
        />
      ))}

      <AutoOrbit />
    </>
  );
}

export function HiveScene({ members }: HiveSceneProps) {
  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <Canvas
        camera={{ position: [0, 5, 12], fov: 50 }}
        style={{ background: "transparent" }}
        gl={{ antialias: true, alpha: true }}
      >
        <SceneContent members={members} />
      </Canvas>
    </div>
  );
}
