"use client";

import type { SceneState } from "@/types/agent-events";

interface HUDOverlayProps {
  state: SceneState;
}

export function HUDOverlay({ state }: HUDOverlayProps) {
  const recentMessages = state.hudMessages.slice(-12);

  return (
    <div
      style={{
        position: "absolute",
        bottom: 20,
        left: 20,
        right: 20,
        pointerEvents: "none",
        fontFamily: "'Atkinson Hyperlegible Mono', monospace",
        fontWeight: 300,
        fontSize: "11px",
        letterSpacing: "-0.5px",
      }}
    >
      {/* Connection indicator */}
      <div
        style={{
          position: "absolute",
          top: -40,
          right: 0,
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <div
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            backgroundColor: state.connected ? "#00f0ff" : "#ff4444",
            boxShadow: state.connected
              ? "0 0 6px #00f0ff"
              : "0 0 6px #ff4444",
          }}
        />
        <span style={{ color: "#666" }}>
          {state.connected ? "live" : "disconnected"}
        </span>
      </div>

      {/* Event log */}
      <div
        style={{
          maxHeight: 180,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          gap: 2,
        }}
      >
        {recentMessages.map((msg, i) => {
          const age = Date.now() - msg.timestamp;
          const opacity = age < 5000 ? 0.9 : Math.max(0.2, 1 - age / 30000);
          return (
            <div
              key={`${msg.timestamp}-${i}`}
              style={{
                color: msg.color,
                opacity,
                transition: "opacity 1s",
              }}
            >
              <span style={{ color: "#444", marginRight: 8 }}>
                {new Date(msg.timestamp).toLocaleTimeString("en-US", {
                  hour12: false,
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })}
              </span>
              {msg.text}
            </div>
          );
        })}
      </div>
    </div>
  );
}
