"use client";

import { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { AgentNode } from "./AgentNode";
import { DebateBeam } from "./DebateBeam";
import { BurstEffect } from "./BurstEffect";
import { PaymentRing } from "./PaymentRing";
import { SpiralEffect } from "./SpiralEffect";
import { HUDOverlay } from "./HUDOverlay";
import { useAgentStream } from "@/hooks/useAgentStream";
import { useSceneState } from "@/hooks/useSceneState";
import type { AgentName, SceneState } from "@/types/agent-events";

const AGENT_NAMES: AgentName[] = ["kamiyo", "oracle", "chaos", "sage"];

function Effects({ state }: { state: SceneState }) {
  return (
    <>
      {state.effects.map((effect) => {
        switch (effect.type) {
          case "beam":
            return <DebateBeam key={effect.id} effect={effect} />;
          case "burst":
            return <BurstEffect key={effect.id} effect={effect} />;
          case "ring":
            return <PaymentRing key={effect.id} effect={effect} />;
          case "spiral":
            return <SpiralEffect key={effect.id} effect={effect} />;
          default:
            return null;
        }
      })}
    </>
  );
}

const AGENT_POSITIONS: Record<AgentName, [number, number, number]> = {
  kamiyo: [0, 0, -3],
  oracle: [-3, 0, 1],
  sage: [3, 0, 1],
  chaos: [0, 0, 4],
};

function AutoOrbit({ target }: { target: AgentName | "center" }) {
  const controlsRef = useRef<any>(null);
  const angleRef = useRef(0);
  const userInteracted = useRef(false);
  const lastInteraction = useRef(0);

  useFrame((_, delta) => {
    if (!controlsRef.current) return;

    // Resume auto-orbit after 10s of no interaction
    const now = Date.now();
    if (userInteracted.current && now - lastInteraction.current > 10000) {
      userInteracted.current = false;
    }

    if (!userInteracted.current) {
      angleRef.current += delta * 0.15;
      const radius = target === "center" ? 12 : 8;
      const x = Math.sin(angleRef.current) * radius;
      const z = Math.cos(angleRef.current) * radius;
      const targetPos = target === "center" ? [0, 0, 0] : AGENT_POSITIONS[target];

      controlsRef.current.object.position.lerp(
        new THREE.Vector3(x, 3, z),
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
      enableZoom={false}
      enablePan={false}
      dampingFactor={0.05}
      onStart={() => {
        userInteracted.current = true;
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

      {AGENT_NAMES.map((name) => (
        <AgentNode key={name} name={name} state={state.agents[name]} />
      ))}

      <Effects state={state} />
      <AutoOrbit target={state.cameraTarget} />

      {/* Ground reference grid */}
      <gridHelper args={[20, 20, "#111", "#0a0a0a"]} position={[0, -1, 0]} />
    </>
  );
}

export function AgentScene() {
  const { events, connected } = useAgentStream();
  const state = useSceneState(events, connected);

  return (
    <div style={{ position: "relative", width: "100%", height: "100vh" }}>
      <Canvas
        camera={{ position: [0, 3, 12], fov: 50 }}
        style={{ background: "#000" }}
        gl={{ antialias: true, alpha: false }}
      >
        <SceneContent state={state} />
      </Canvas>
      <HUDOverlay state={state} />
    </div>
  );
}
