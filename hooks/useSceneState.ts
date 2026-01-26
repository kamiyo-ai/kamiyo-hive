"use client";

import { useReducer, useEffect, useRef } from "react";
import type {
  AgentEvent,
  AgentName,
  AgentVisualState,
  ActiveEffect,
  SceneState,
  AGENT_POSITIONS,
  AGENT_COLORS,
} from "@/types/agent-events";

const AGENT_NAMES: AgentName[] = ["kamiyo", "oracle", "chaos", "sage"];

const POSITIONS: Record<AgentName, [number, number, number]> = {
  kamiyo: [0, 0, -3],
  oracle: [-3, 0, 1],
  sage: [3, 0, 1],
  chaos: [0, 0, 4],
};

const COLORS: Record<AgentName, string> = {
  kamiyo: "#00f0ff",
  oracle: "#9944ff",
  chaos: "#ff44f5",
  sage: "#ffaa22",
};

function initialAgentState(name: AgentName): AgentVisualState {
  return {
    position: POSITIONS[name],
    color: COLORS[name],
    intensity: 0.3,
    speaking: false,
    scale: 1,
  };
}

const initialState: SceneState = {
  agents: Object.fromEntries(
    AGENT_NAMES.map((n) => [n, initialAgentState(n)])
  ) as Record<AgentName, AgentVisualState>,
  effects: [],
  cameraTarget: "center",
  hudMessages: [],
  connected: false,
};

type Action =
  | { type: "event"; event: AgentEvent }
  | { type: "tick"; now: number }
  | { type: "setConnected"; connected: boolean };

// Patterns that indicate real agent activity (triggers network light-up)
const ACTIVITY_RE = /^action:|^model:call:|^context:|graph:|introspection:|debate:|mood:|interest:/;

function createEffect(event: AgentEvent): ActiveEffect | null {
  const base = {
    id: event.id,
    color: "#ffffff",
    progress: 0,
    startedAt: Date.now(),
    duration: 2000,
    data: event.data,
  };

  switch (event.type) {
    case "debate:message":
      return { ...base, type: "beam", source: event.source };
    case "debate:synthesize":
      return { ...base, type: "beam", source: event.source };
    case "tweet:posted":
      return { ...base, type: "beam", source: "kamiyo" };
    case "mention:received":
      return { ...base, type: "beam", source: "kamiyo" };
    case "mood:transition":
      return { ...base, type: "beam", source: "kamiyo" };
    case "system:log": {
      const msg = (event.data.message as string) || "";
      if (ACTIVITY_RE.test(msg)) {
        return { ...base, id: event.id + "-fx", type: "beam", source: event.source || "kamiyo" };
      }
      // Still create effect for any system log to show activity
      return { ...base, id: event.id + "-fx", type: "beam", source: event.source || "kamiyo", duration: 1000 };
    }
    default:
      return null;
  }
}

function reducer(state: SceneState, action: Action): SceneState {
  switch (action.type) {
    case "setConnected":
      return { ...state, connected: action.connected };

    case "tick": {
      const now = action.now;
      // Remove expired effects, update progress
      const effects = state.effects
        .map((e) => ({
          ...e,
          progress: Math.min(1, (now - e.startedAt) / e.duration),
        }))
        .filter((e) => e.progress < 1);

      // Decay agent intensity/speaking
      const agents = { ...state.agents };
      for (const name of AGENT_NAMES) {
        const a = agents[name];
        if (a.speaking && !effects.some((e) => e.source === name && e.type === "beam")) {
          agents[name] = { ...a, speaking: false, intensity: Math.max(0.3, a.intensity - 0.02) };
        }
      }

      return { ...state, effects, agents };
    }

    case "event": {
      const event = action.event;
      const agents = { ...state.agents };
      let cameraTarget = state.cameraTarget;

      // Update agent state based on event
      // Agent lights up for debate, tweet, mood, mention, and system (introspection) events
      const speakingCategories = ["debate", "tweet", "mood", "mention", "system"];
      const source = event.source || "kamiyo"; // Default to kamiyo if no source
      if (agents[source]) {
        const agent = agents[source];
        const isSpeaking = speakingCategories.includes(event.category);
        agents[source] = {
          ...agent,
          speaking: isSpeaking,
          intensity: event.visual.intensity,
          scale: event.category === "debate" ? 1.2 : 1,
        };
        if (event.category === "debate") {
          cameraTarget = source;
        }
      }

      if (event.type === "mood:transition") {
        agents.kamiyo = {
          ...agents.kamiyo,
          mood: event.data.to as string,
        };
      }

      // Create visual effect
      const effect = createEffect(event);
      const effects = effect
        ? [...state.effects, effect].slice(-20) // max 20 concurrent effects
        : state.effects;

      // HUD message
      const hudMsg = formatHudMessage(event);
      const hudMessages = hudMsg
        ? [...state.hudMessages, hudMsg].slice(-30)
        : state.hudMessages;

      return { ...state, agents, effects, cameraTarget, hudMessages };
    }

    default:
      return state;
  }
}

function formatHudMessage(event: AgentEvent): { text: string; timestamp: number; color: string; spinner?: boolean } | null {
  const ts = event.timestamp;
  const color = event.visual.color;

  switch (event.type) {
    case "debate:start":
      return { text: `debate: ${event.data.topic}`, timestamp: ts, color };
    case "debate:message":
      return { text: `${event.source}: ${(event.data.content as string)?.slice(0, 60)}...`, timestamp: ts, color };
    case "debate:synthesize":
      return { text: `synthesis complete`, timestamp: ts, color };
    case "tweet:posted":
      return { text: `posted: ${(event.data.content as string)?.slice(0, 50)}`, timestamp: ts, color };
    case "mention:received":
      return { text: `mention from @${event.data.from}`, timestamp: ts, color };
    case "mood:transition":
      return { text: `mood: ${event.data.from} -> ${event.data.to}`, timestamp: ts, color };
    case "payment:request":
      return { text: `402: ${event.data.service} (${event.data.amount} USDC)`, timestamp: ts, color };
    case "payment:verified":
      return { text: `paid: ${event.data.service}`, timestamp: ts, color };
    case "proof:generating":
      return { text: `proving: ${event.data.type}`, timestamp: ts, color, spinner: true };
    case "proof:complete":
      return { text: `proof complete (${event.data.timeMs}ms)`, timestamp: ts, color };
    case "system:heartbeat":
      return { text: `heartbeat — ${event.data.memoryMb}MB | ${Math.floor(event.data.uptime as number / 60)}m uptime | ${event.data.clients} clients`, timestamp: ts, color };
    case "system:log":
      return { text: event.data.message as string, timestamp: ts, color, spinner: !!event.data.spinner };
    default:
      return null;
  }
}

export function useSceneState(events: AgentEvent[], connected: boolean) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const lastProcessed = useRef(0);

  // Process new events
  useEffect(() => {
    const newEvents = events.slice(lastProcessed.current);
    for (const event of newEvents) {
      dispatch({ type: "event", event });
    }
    lastProcessed.current = events.length;
  }, [events]);

  // Connection state
  useEffect(() => {
    dispatch({ type: "setConnected", connected });
  }, [connected]);

  // Tick loop for effect animation
  useEffect(() => {
    let raf: number;
    const tick = () => {
      dispatch({ type: "tick", now: Date.now() });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return state;
}
