"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import type { SceneState } from "@/types/agent-events";

interface HUDOverlayProps {
  state: SceneState;
}

export function HUDOverlay({ state }: HUDOverlayProps) {
  const recentMessages = state.hudMessages.slice(-16);
  const [position, setPosition] = useState<{ x: number; y: number | null }>({ x: 20, y: null });
  const [collapsed, setCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const dragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const dragStartPos = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const startDrag = useCallback((clientX: number, clientY: number) => {
    if (isMobile) return;
    dragging.current = true;
    dragStartPos.current = { x: clientX, y: clientY };
    dragOffset.current = {
      x: clientX - position.x,
      y: clientY - (position.y ?? clientY),
    };
  }, [position, isMobile]);

  const moveDrag = useCallback((clientX: number, clientY: number) => {
    if (!dragging.current) return;
    setPosition({
      x: clientX - dragOffset.current.x,
      y: clientY - dragOffset.current.y,
    });
  }, []);

  const endDrag = useCallback((clientX: number, clientY: number) => {
    if (!dragging.current) return;
    dragging.current = false;
    const dx = Math.abs(clientX - dragStartPos.current.x);
    const dy = Math.abs(clientY - dragStartPos.current.y);
    if (dx < 5 && dy < 5) {
      setCollapsed((c) => !c);
    }
  }, []);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    startDrag(e.clientX, e.clientY);

    const onMouseMove = (ev: MouseEvent) => moveDrag(ev.clientX, ev.clientY);
    const onMouseUp = (ev: MouseEvent) => {
      endDrag(ev.clientX, ev.clientY);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }, [startDrag, moveDrag, endDrag]);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    startDrag(touch.clientX, touch.clientY);
  }, [startDrag]);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    moveDrag(touch.clientX, touch.clientY);
  }, [moveDrag]);

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    const touch = e.changedTouches[0];
    endDrag(touch.clientX, touch.clientY);
  }, [endDrag]);

  const toggleCollapse = () => setCollapsed((c) => !c);

  return (
    <div
      style={{
        position: "absolute",
        ...(isMobile
          ? { bottom: 80, left: 8, right: 8, top: "auto", transform: "none" }
          : {
              top: position.y !== null ? position.y : "50%",
              left: position.x,
              transform: position.y === null ? "translateY(-50%)" : undefined,
              width: 560,
            }),
        pointerEvents: "auto",
        fontFamily: "'Atkinson Hyperlegible Mono', monospace",
        fontWeight: 300,
        fontSize: "10px",
        letterSpacing: "-0.5px",
        zIndex: 10,
      }}
    >
      <div
        style={{
          background: "rgba(10, 10, 15, 0.92)",
          border: "1px solid #222",
          borderRadius: 8,
          overflow: "hidden",
          boxShadow: "0 4px 24px rgba(0,0,0,0.5)",
        }}
      >
        {/* Title bar */}
        <div
          onMouseDown={!isMobile ? onMouseDown : undefined}
          onTouchStart={!isMobile ? onTouchStart : undefined}
          onTouchMove={!isMobile ? onTouchMove : undefined}
          onTouchEnd={!isMobile ? onTouchEnd : undefined}
          onClick={isMobile ? toggleCollapse : undefined}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "10px 12px",
            borderBottom: collapsed ? "none" : "1px solid #222",
            background: "rgba(20, 20, 25, 0.95)",
            cursor: isMobile ? "pointer" : "grab",
            userSelect: "none",
          }}
        >
          <span style={{ color: "#555", fontSize: "11px" }}>
            kamiyo — events
          </span>
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
            <div
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                backgroundColor: state.connected ? "#00f0ff" : "#ff4444",
                boxShadow: state.connected ? "0 0 6px #00f0ff" : "0 0 6px #ff4444",
              }}
            />
            <span style={{ color: "#555", fontSize: "10px" }}>
              {state.connected ? "live" : "offline"}
            </span>
            {/* Collapse toggle */}
            <button
              onClick={(e) => { e.stopPropagation(); toggleCollapse(); }}
              style={{
                background: "none",
                border: "none",
                padding: "2px 6px",
                cursor: "pointer",
                color: "#555",
                fontSize: "14px",
                lineHeight: 1,
                transition: "transform 0.2s",
                transform: collapsed ? "rotate(180deg)" : "rotate(0deg)",
              }}
              aria-label={collapsed ? "Expand" : "Collapse"}
            >
              ▼
            </button>
          </div>
        </div>

        {/* Log content */}
        <div
          style={{
            maxHeight: collapsed ? 0 : (isMobile ? 180 : 320),
            padding: collapsed ? "0 12px" : "10px 12px",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            gap: 4,
            transition: "max-height 0.25s ease, padding 0.25s ease",
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
