"use client";

import { useRef, useState, useCallback } from "react";
import type { SceneState } from "@/types/agent-events";

interface HUDOverlayProps {
  state: SceneState;
}


export function HUDOverlay({ state }: HUDOverlayProps) {
  const recentMessages = state.hudMessages.slice(-16);
  const [position, setPosition] = useState<{ x: number; y: number | null }>({ x: 20, y: null });
  const dragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    dragging.current = true;
    dragOffset.current = {
      x: e.clientX - position.x,
      y: e.clientY - (position.y ?? e.clientY),
    };

    const onMouseMove = (ev: MouseEvent) => {
      if (!dragging.current) return;
      setPosition({
        x: ev.clientX - dragOffset.current.x,
        y: ev.clientY - dragOffset.current.y,
      });
    };

    const onMouseUp = () => {
      dragging.current = false;
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }, [position]);

  return (
    <div
      style={{
        position: "absolute",
        top: position.y !== null ? position.y : "50%",
        left: position.x,
        transform: position.y === null ? "translateY(-50%)" : undefined,
        pointerEvents: "auto",
        fontFamily: "'Atkinson Hyperlegible Mono', monospace",
        fontWeight: 300,
        fontSize: "10px",
        letterSpacing: "-0.5px",
        width: 560,
        zIndex: 10,
      }}
    >
      {/* Terminal window */}
      <div
        style={{
          background: "rgba(10, 10, 15, 0.9)",
          border: "1px solid #222",
          borderRadius: 8,
          overflow: "hidden",
          boxShadow: "0 4px 24px rgba(0,0,0,0.5)",
        }}
      >
        {/* Title bar — draggable */}
        <div
          onMouseDown={onMouseDown}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "8px 12px",
            borderBottom: "1px solid #222",
            background: "rgba(20, 20, 25, 0.95)",
            cursor: "grab",
            userSelect: "none",
          }}
        >
          <span style={{ color: "#555", fontSize: "11px" }}>
            kamiyo — events
          </span>
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
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
            <span style={{ color: "#555", fontSize: "10px" }}>
              {state.connected ? "live" : "offline"}
            </span>
          </div>
        </div>

        {/* Log content */}
        <div
          style={{
            padding: "10px 12px",
            maxHeight: 320,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            gap: 4,
          }}
        >
          {recentMessages.map((msg, i) => {
            const age = Date.now() - msg.timestamp;
            const opacity = age < 5000 ? 0.9 : Math.max(0.2, 1 - age / 30000);
            return (
              <div
                key={`${msg.timestamp}-${i}`}
                style={{
                  opacity,
                  transition: "opacity 1s",
                  lineHeight: "1.5",
                  color: "#888",
                }}
              >
                <span style={{ color: "#555", marginRight: 8 }}>
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
    </div>
  );
}
