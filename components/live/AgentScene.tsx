"use client";

import { useRef, useState, useCallback } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { AgentNode } from "./AgentNode";
import { ParticleWeb, ALL_AGENTS } from "./ParticleWeb";
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

// 3 additional agents (7 total)
const EXTRA_AGENTS: Array<{ id: string; position: [number, number, number]; color: string; phaseOffset: number }> = [
  { id: "agent-5", position: [-5, 1.2, -4], color: "#00f0ff", phaseOffset: 0.1 },
  { id: "agent-6", position: [5, -0.8, -2], color: "#ff44f5", phaseOffset: 0.25 },
  { id: "agent-7", position: [-4, 1.5, 4], color: "#22ff88", phaseOffset: 0.4 },
];

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

interface SceneContentProps {
  state: SceneState;
  simulatedSpeaking: Set<number>;
  onAgentReceive: (idx: number) => void;
}

function SceneContent({ state, simulatedSpeaking, onAgentReceive }: SceneContentProps) {
  return (
    <>
      <ambientLight intensity={0.1} />
      <pointLight position={[0, 5, 0]} intensity={0.5} color="#00f0ff" />
      <pointLight position={[-4, 3, -2]} intensity={0.3} color="#ff44f5" />
      <pointLight position={[4, 3, 2]} intensity={0.2} color="#ffaa22" />

      <ParticleWeb speakingAgents={simulatedSpeaking} onAgentReceive={onAgentReceive} />

      {/* Original 4 agents */}
      {AGENT_NAMES.map((name, i) => (
        <AgentNode
          key={name}
          name={name}
          state={{
            ...state.agents[name],
            speaking: state.agents[name].speaking || simulatedSpeaking.has(i),
          }}
          phaseOffset={i * 0.25}
        />
      ))}

      {/* 3 additional agents */}
      {EXTRA_AGENTS.map((agent, i) => (
        <AgentNode
          key={agent.id}
          name={agent.id}
          state={{
            position: agent.position,
            color: agent.color,
            intensity: 0.5,
            speaking: simulatedSpeaking.has(4 + i),
            scale: 1,
          }}
          phaseOffset={agent.phaseOffset}
        />
      ))}

      <AutoOrbit target={state.cameraTarget} />
    </>
  );
}

interface AgentSceneProps {
  hideHUD?: boolean;
}

export function AgentScene({ hideHUD = false }: AgentSceneProps) {
  const { events, connected } = useAgentStream();
  const state = useSceneState(events, connected);
  const [simulatedSpeaking, setSimulatedSpeaking] = useState<Set<number>>(new Set());
  const speakingTimeouts = useRef<Map<number, NodeJS.Timeout>>(new Map());

  // Simulate agent speaking for a duration
  const triggerSpeaking = useCallback((idx: number, duration: number = 1500) => {
    // Clear existing timeout for this agent
    const existing = speakingTimeouts.current.get(idx);
    if (existing) clearTimeout(existing);

    // Add to speaking set
    setSimulatedSpeaking(prev => new Set(prev).add(idx));

    // Remove after duration
    const timeout = setTimeout(() => {
      setSimulatedSpeaking(prev => {
        const next = new Set(prev);
        next.delete(idx);
        return next;
      });
      speakingTimeouts.current.delete(idx);
    }, duration);

    speakingTimeouts.current.set(idx, timeout);
  }, []);

  // When an agent receives a message, they light up briefly
  const handleAgentReceive = useCallback((idx: number) => {
    triggerSpeaking(idx, 2500);
  }, [triggerSpeaking]);

  // Start a random agent speaking periodically
  const lastInitiator = useRef(0);
  const initiateConversation = useCallback(() => {
    const now = Date.now();
    if (now - lastInitiator.current > 3000 + Math.random() * 2000) {
      lastInitiator.current = now;
      const randomAgent = Math.floor(Math.random() * 7);
      triggerSpeaking(randomAgent, 2000);
    }
  }, [triggerSpeaking]);

  // Periodically start conversations
  useRef(() => {
    const interval = setInterval(initiateConversation, 1000);
    return () => clearInterval(interval);
  });

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <Canvas
        camera={{ position: [0, 1.5, 8.1], fov: 50 }}
        style={{ background: "#000" }}
        gl={{ antialias: true, alpha: false }}
        onCreated={() => {
          // Start initial conversation
          setTimeout(() => triggerSpeaking(0, 3500), 500);
        }}
      >
        <ConversationManager triggerSpeaking={triggerSpeaking} />
        <SceneContent
          state={state}
          simulatedSpeaking={simulatedSpeaking}
          onAgentReceive={handleAgentReceive}
        />
      </Canvas>
      {!hideHUD && <HUDOverlay state={state} />}
    </div>
  );
}

// Component to manage conversation initiation inside the canvas
function ConversationManager({ triggerSpeaking }: { triggerSpeaking: (idx: number, duration?: number) => void }) {
  const lastInitiation = useRef(0);

  useFrame(() => {
    const now = Date.now();
    if (now - lastInitiation.current > 4000 + Math.random() * 2000) {
      lastInitiation.current = now;
      const randomAgent = Math.floor(Math.random() * 7);
      triggerSpeaking(randomAgent, 3500);
    }
  });

  return null;
}
