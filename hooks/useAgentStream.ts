"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import type { AgentEvent } from "@/types/agent-events";

const WS_URL = process.env.NEXT_PUBLIC_BOT_WS_URL || "ws://localhost:4021";
const RECONNECT_DELAY = 3000;
const MAX_EVENTS = 500;

export function useAgentStream() {
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(WS_URL);

    ws.onopen = () => {
      setConnected(true);
      if (reconnectRef.current) {
        clearTimeout(reconnectRef.current);
        reconnectRef.current = null;
      }
    };

    ws.onclose = () => {
      setConnected(false);
      wsRef.current = null;
      reconnectRef.current = setTimeout(connect, RECONNECT_DELAY);
    };

    ws.onerror = () => {
      ws.close();
    };

    ws.onmessage = (msg) => {
      try {
        const data = JSON.parse(msg.data);
        if (data.type === "replay") {
          setEvents(data.events);
        } else if (data.type === "event") {
          setEvents((prev) => {
            const next = [...prev, data.event];
            return next.length > MAX_EVENTS ? next.slice(-MAX_EVENTS) : next;
          });
        }
      } catch {
        // Ignore malformed messages
      }
    };

    wsRef.current = ws;
  }, []);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      wsRef.current?.close();
    };
  }, [connect]);

  // Pause when tab hidden
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) {
        wsRef.current?.close();
      } else {
        connect();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [connect]);

  return { events, connected };
}
