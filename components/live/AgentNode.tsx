"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import type { AgentVisualState, AgentName } from "@/types/agent-events";

interface AgentNodeProps {
  name: AgentName;
  state: AgentVisualState;
}

export function AgentNode({ name, state }: AgentNodeProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const targetIntensity = useRef(state.intensity);
  const targetScale = useRef(state.scale);

  targetIntensity.current = state.intensity;
  targetScale.current = state.scale;

  useFrame((_, delta) => {
    if (!meshRef.current) return;

    // Smooth rotation
    meshRef.current.rotation.y += delta * 0.3;
    meshRef.current.rotation.x += delta * 0.1;

    // Lerp scale
    const s = meshRef.current.scale.x;
    const t = targetScale.current;
    const newScale = s + (t - s) * Math.min(1, delta * 4);
    meshRef.current.scale.setScalar(newScale);

    // Glow pulse
    if (glowRef.current) {
      const mat = glowRef.current.material as THREE.MeshBasicMaterial;
      const targetOpacity = state.speaking ? 0.4 + Math.sin(Date.now() * 0.008) * 0.2 : 0.15;
      mat.opacity += (targetOpacity - mat.opacity) * Math.min(1, delta * 6);
      const glowScale = newScale * (1.4 + (state.speaking ? Math.sin(Date.now() * 0.005) * 0.1 : 0));
      glowRef.current.scale.setScalar(glowScale);
    }
  });

  const color = new THREE.Color(state.color);

  return (
    <group position={state.position}>
      {/* Glow sphere */}
      <mesh ref={glowRef}>
        <sphereGeometry args={[0.6, 16, 16]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.15}
          depthWrite={false}
        />
      </mesh>

      {/* Core icosahedron */}
      <mesh ref={meshRef}>
        <icosahedronGeometry args={[0.4, 1]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={state.intensity * 0.8}
          wireframe
          transparent
          opacity={0.9}
        />
      </mesh>

      {/* Inner solid core */}
      <mesh>
        <icosahedronGeometry args={[0.2, 0]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={state.intensity * 1.2}
        />
      </mesh>

      {/* Label */}
      <Html
        position={[0, -0.9, 0]}
        center
        distanceFactor={8}
        style={{ pointerEvents: "none" }}
      >
        <div
          style={{
            fontFamily: "'Atkinson Hyperlegible Mono', monospace",
            fontSize: "11px",
            fontWeight: 300,
            color: state.speaking ? state.color : "#666",
            letterSpacing: "-0.5px",
            textTransform: "uppercase",
            whiteSpace: "nowrap",
            transition: "color 0.3s",
          }}
        >
          {name}
          {state.mood && name === "kamiyo" && (
            <span style={{ color: "#444", marginLeft: 6 }}>{state.mood}</span>
          )}
        </div>
      </Html>
    </group>
  );
}
