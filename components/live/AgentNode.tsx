"use client";

import { useRef, useMemo, useState, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import type { AgentVisualState, AgentName } from "@/types/agent-events";

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

const AGENT_ICONS: Record<AgentName, string> = {
  kamiyo: "/icons/icon-settlement.svg",
  oracle: "/icons/icon-oracle.svg",
  sage: "/icons/icon-agreement.svg",
  chaos: "/icons/icon-delivered.svg",
};

interface AgentNodeProps {
  name: AgentName;
  state: AgentVisualState;
}

const NODE_COUNT = 24;
const WEB_RADIUS = 0.85;
const CONNECTION_DIST = 1.0;

interface MiniNodeData {
  position: THREE.Vector3;
  basePosition: THREE.Vector3;
  velocity: THREE.Vector3;
  phase: number;
  speed: number;
  drift: THREE.Vector3;
}

function AgentWeb({ color, active }: { color: string; active: boolean }) {
  const nodesRef = useRef<MiniNodeData[]>(null);
  const pointsGeo = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(NODE_COUNT * 3), 3));
    geo.setAttribute("color", new THREE.BufferAttribute(new Float32Array(NODE_COUNT * 3), 3));
    return geo;
  }, []);

  const linesGeo = useMemo(() => {
    const maxLines = (NODE_COUNT * (NODE_COUNT - 1)) / 2;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(maxLines * 6), 3));
    geo.setAttribute("color", new THREE.BufferAttribute(new Float32Array(maxLines * 6), 3));
    geo.setDrawRange(0, 0);
    return geo;
  }, []);

  // Initialize nodes in a sphere around origin
  if (!nodesRef.current) {
    nodesRef.current = Array.from({ length: NODE_COUNT }, () => {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 0.25 + Math.random() * (WEB_RADIUS - 0.25);
      const pos = new THREE.Vector3(
        r * Math.sin(phi) * Math.cos(theta),
        r * Math.sin(phi) * Math.sin(theta) * 0.6,
        r * Math.cos(phi)
      );
      return {
        position: pos.clone(),
        basePosition: pos.clone(),
        velocity: new THREE.Vector3(),
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
    const restColor = new THREE.Color("#1a1a2e");
    const dimLine = new THREE.Color("#0d0d1a");

    // Smooth activation transition
    const target_activation = active ? 1 : 0;
    activation.current += (target_activation - activation.current) * delta * 4;
    const a = activation.current;

    const posAttr = pointsGeo.getAttribute("position") as THREE.BufferAttribute;
    const colorAttr = pointsGeo.getAttribute("color") as THREE.BufferAttribute;
    const linePos = linesGeo.getAttribute("position") as THREE.BufferAttribute;
    const lineCol = linesGeo.getAttribute("color") as THREE.BufferAttribute;

    for (let i = 0; i < NODE_COUNT; i++) {
      const node = nodes[i];
      posAttr.setXYZ(i, node.basePosition.x, node.basePosition.y, node.basePosition.z);
      const nodeColor = restColor.clone().lerp(c, a);
      colorAttr.setXYZ(i, nodeColor.r, nodeColor.g, nodeColor.b);
    }
    posAttr.needsUpdate = true;
    colorAttr.needsUpdate = true;

    // Draw connections
    let lineIndex = 0;
    for (let i = 0; i < NODE_COUNT; i++) {
      for (let j = i + 1; j < NODE_COUNT; j++) {
        const dist = nodes[i].position.distanceTo(nodes[j].position);
        if (dist < CONNECTION_DIST) {
          const proximity = 1 - dist / CONNECTION_DIST;
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
          size={0.05}
          vertexColors
          transparent
          opacity={0.85}
          depthWrite={false}
          sizeAttenuation
        />
      </points>
      <lineSegments geometry={linesGeo}>
        <lineBasicMaterial
          vertexColors
          transparent
          opacity={0.45}
          depthWrite={false}
        />
      </lineSegments>
    </group>
  );
}

export function AgentNode({ name, state }: AgentNodeProps) {
  const spriteRef = useRef<THREE.Sprite>(null);

  const iconTexture = useSvgTexture(AGENT_ICONS[name]);

  return (
    <group position={state.position}>
      {/* Mini web around agent */}
      <AgentWeb color={state.color} active={state.speaking} />

      {/* Icon sprite */}
      {iconTexture && (
        <sprite ref={spriteRef} scale={[0.22, 0.22, 1]}>
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
            KAMIYO
          </span>
          <span style={{ fontWeight: 300, color: state.speaking ? state.color : "#666" }}>
            {name === "kamiyo" ? (state.mood || "creative") : name}
          </span>
        </div>
      </Html>
    </group>
  );
}
