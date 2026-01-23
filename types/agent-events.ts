export type AgentName = "kamiyo" | "oracle" | "chaos" | "sage";

export type EventCategory =
  | "debate"
  | "tweet"
  | "mention"
  | "mood"
  | "payment"
  | "proof"
  | "ratelimit"
  | "system";

export interface AgentEvent {
  id: string;
  type: string;
  category: EventCategory;
  timestamp: number;
  source?: AgentName;
  target?: AgentName;
  data: Record<string, unknown>;
  visual: {
    color: string;
    intensity: number;
    duration?: number;
  };
}

export const AGENT_COLORS: Record<AgentName, string> = {
  kamiyo: "#00f0ff",
  oracle: "#9944ff",
  chaos: "#ff44f5",
  sage: "#ffaa22",
};

export const AGENT_POSITIONS: Record<AgentName, [number, number, number]> = {
  kamiyo: [0, 0, -3],
  oracle: [-3, 0, 1],
  sage: [3, 0, 1],
  chaos: [0, 0, 4],
};

export interface AgentVisualState {
  position: [number, number, number];
  color: string;
  intensity: number;
  speaking: boolean;
  scale: number;
  mood?: string;
}

export interface ActiveEffect {
  id: string;
  type: "beam" | "burst" | "ring" | "incoming";
  source?: AgentName;
  target?: AgentName;
  color: string;
  progress: number;
  startedAt: number;
  duration: number;
  data: Record<string, unknown>;
}

export interface SceneState {
  agents: Record<AgentName, AgentVisualState>;
  effects: ActiveEffect[];
  cameraTarget: AgentName | "center";
  hudMessages: Array<{ text: string; timestamp: number; color: string }>;
  connected: boolean;
}
