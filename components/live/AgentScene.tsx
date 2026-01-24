"use client";

import { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { AgentNode } from "./AgentNode";
import { ParticleWeb } from "./ParticleWeb";
import { HUDOverlay } from "./HUDOverlay";
import { useAgentStream } from "@/hooks/useAgentStream";
import { useSceneState } from "@/hooks/useSceneState";
import type { AgentName, SceneState } from "@/types/agent-events";

const AGENT_NAMES: AgentName[] = ["kamiyo", "oracle", "chaos", "sage"];


const AGENT_POSITIONS: Record<AgentName, [number, number, number]> = {
  kamiyo: [0, 0, -3.6],
  oracle: [-3.6, 0, 1.2],
  sage: [3.6, 0, 1.2],
  chaos: [0, 0, 4.8],
};

function AutoOrbit({ target }: { target: AgentName | "center" }) {
  const controlsRef = useRef<any>(null);
  const angleRef = useRef(0);
  const dragging = useRef(false);
  const lastInteraction = useRef(0);

  useFrame((_, delta) => {
    if (!controlsRef.current) return;

    const now = Date.now();
    const idle = now - lastInteraction.current > 3000;

    if (!dragging.current && idle) {
      // Sync angle from current camera position so it resumes smoothly
      if (lastInteraction.current > 0 && now - lastInteraction.current < 3200) {
        const cam = controlsRef.current.object.position;
        angleRef.current = Math.atan2(cam.x, cam.z);
      }

      angleRef.current += delta * 0.15;
      const radius = target === "center" ? 7.5 : 5;
      const x = Math.sin(angleRef.current) * radius;
      const z = Math.cos(angleRef.current) * radius;
      const targetPos = target === "center" ? [0, 0, 0.6] : AGENT_POSITIONS[target];

      controlsRef.current.object.position.lerp(
        new THREE.Vector3(x, 1.5, z),
        delta * 0.5
      );
      controlsRef.current.target.lerp(
        new THREE.Vector3(...targetPos),
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

function SceneContent({ state }: { state: SceneState }) {
  return (
    <>
      <ambientLight intensity={0.1} />
      <pointLight position={[0, 5, 0]} intensity={0.5} color="#00f0ff" />
      <pointLight position={[-4, 3, -2]} intensity={0.3} color="#ff44f5" />
      <pointLight position={[4, 3, 2]} intensity={0.2} color="#ffaa22" />

      <ParticleWeb effects={state.effects} />

      {AGENT_NAMES.map((name) => (
        <AgentNode key={name} name={name} state={state.agents[name]} />
      ))}

      <AutoOrbit target={state.cameraTarget} />
    </>
  );
}

export function AgentScene() {
  const { events, connected } = useAgentStream();
  const state = useSceneState(events, connected);

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <Canvas
        camera={{ position: [0, 1.5, 8.1], fov: 50 }}
        style={{ background: "#000" }}
        gl={{ antialias: true, alpha: false }}
      >
        <SceneContent state={state} />
      </Canvas>
      <HUDOverlay state={state} />
    </div>
  );
}
