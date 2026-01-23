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

const SWARM_COUNT = 56;
const SWARM_RADIUS = 0.6;

function AgentSwarm({ color, active }: { color: string; active: boolean }) {
  const groupRef = useRef<THREE.Group>(null);
  const nodesRef = useRef<THREE.Points>(null);

  // Random seeds per node for chaotic movement
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
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    return geo;
  }, []);

  useFrame(() => {
    const posAttr = geometry.getAttribute("position") as THREE.BufferAttribute;
    const colorAttr = geometry.getAttribute("color") as THREE.BufferAttribute;
    const c = new THREE.Color(color);
    const dim = new THREE.Color("#1a1a2e");
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
    <group ref={groupRef}>
      <points ref={nodesRef} geometry={geometry}>
        <pointsMaterial
          size={0.04}
          vertexColors
          transparent
          opacity={active ? 0.9 : 0.2}
          depthWrite={false}
          sizeAttenuation
        />
      </points>
    </group>
  );
}

export function AgentNode({ name, state }: AgentNodeProps) {
  const spriteRef = useRef<THREE.Sprite>(null);

  const iconTexture = useSvgTexture(AGENT_ICONS[name]);

  return (
    <group position={state.position}>
      {/* Swarm nodes around agent */}
      <AgentSwarm color={state.color} active={state.speaking} />

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
