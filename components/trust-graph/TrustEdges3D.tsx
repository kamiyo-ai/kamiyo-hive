"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { TrustNode, TrustEdge } from "./types";

interface TrustEdges3DProps {
  nodes: TrustNode[];
  edges: TrustEdge[];
  nodePositions: Map<string, [number, number, number]>;
  selectedNodeId?: string | null;
}

const PULSE_SPEED = 2;
const PULSE_SEGMENTS = 20;

export function TrustEdges3D({
  nodes,
  edges,
  nodePositions,
  selectedNodeId,
}: TrustEdges3DProps) {
  const linesRef = useRef<THREE.LineSegments>(null);
  const pulseRef = useRef<Map<string, number>>(new Map());

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const maxEdges = edges.length;
    const positions = new Float32Array(maxEdges * 6);
    const colors = new Float32Array(maxEdges * 6);
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    return geo;
  }, [edges.length]);

  // Pulse geometry for animated data transfer
  const pulseGeometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(edges.length * PULSE_SEGMENTS * 3);
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return geo;
  }, [edges.length]);

  useFrame((_, delta) => {
    if (!linesRef.current) return;

    const posAttr = geometry.getAttribute("position") as THREE.BufferAttribute;
    const colorAttr = geometry.getAttribute("color") as THREE.BufferAttribute;
    const time = Date.now() * 0.001;

    const baseColor = new THREE.Color("#0a4050");
    const highlightColor = new THREE.Color("#00f0ff");
    const dimColor = new THREE.Color("#082830");

    let idx = 0;
    for (const edge of edges) {
      const sourcePos = nodePositions.get(edge.source);
      const targetPos = nodePositions.get(edge.target);
      if (!sourcePos || !targetPos) continue;

      // Check if edge is connected to selected node
      const isHighlighted =
        selectedNodeId === edge.source || selectedNodeId === edge.target;

      // Edge opacity based on weight (0-100 -> 0.2-1.0)
      const weightFactor = 0.2 + (edge.weight / 100) * 0.8;

      // Animate pulse along edge
      const pulsePhase = (time * PULSE_SPEED + idx * 0.3) % 1;

      // Color based on state
      let edgeColor: THREE.Color;
      if (isHighlighted) {
        edgeColor = highlightColor.clone();
      } else if (selectedNodeId) {
        edgeColor = dimColor.clone();
      } else {
        edgeColor = baseColor.clone().lerp(highlightColor, weightFactor * 0.3);
      }

      // Set positions
      posAttr.setXYZ(idx * 2, sourcePos[0], sourcePos[1], sourcePos[2]);
      posAttr.setXYZ(idx * 2 + 1, targetPos[0], targetPos[1], targetPos[2]);

      // Set colors
      colorAttr.setXYZ(idx * 2, edgeColor.r, edgeColor.g, edgeColor.b);
      colorAttr.setXYZ(idx * 2 + 1, edgeColor.r, edgeColor.g, edgeColor.b);

      idx++;
    }

    posAttr.needsUpdate = true;
    colorAttr.needsUpdate = true;
    geometry.setDrawRange(0, idx * 2);
  });

  return (
    <group>
      <lineSegments ref={linesRef} geometry={geometry}>
        <lineBasicMaterial
          vertexColors
          transparent
          opacity={0.6}
          depthWrite={false}
          linewidth={1}
        />
      </lineSegments>
    </group>
  );
}
