"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { MorphingIconSprite } from "./MorphingIconTexture";
import type { AgentVisualState, AgentName } from "@/types/agent-events";

interface AgentNodeProps {
  name: AgentName | string;
  state: AgentVisualState;
  hideLabel?: boolean;
  phaseOffset?: number;
}

const NODE_COUNT = 16;
const WEB_RADIUS = 1.1;
const CONNECTION_DIST = 1.2;

interface MiniNodeData {
  position: THREE.Vector3;
  basePosition: THREE.Vector3;
  velocity: THREE.Vector3;
  phase: number;
  speed: number;
  drift: THREE.Vector3;
}

function AgentWeb({ color, active }: { color: string; active: boolean }) {
  const nodesRef = useRef<MiniNodeData[]>(null);
  const pointsGeo = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(NODE_COUNT * 3), 3));
    geo.setAttribute("color", new THREE.BufferAttribute(new Float32Array(NODE_COUNT * 3), 3));
    return geo;
  }, []);

  const linesGeo = useMemo(() => {
    const maxLines = (NODE_COUNT * (NODE_COUNT - 1)) / 2;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(maxLines * 6), 3));
    geo.setAttribute("color", new THREE.BufferAttribute(new Float32Array(maxLines * 6), 3));
    geo.setDrawRange(0, 0);
    return geo;
  }, []);

  // Initialize nodes in a sphere around origin
  if (!nodesRef.current) {
    nodesRef.current = Array.from({ length: NODE_COUNT }, () => {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 0.6 + Math.random() * (WEB_RADIUS - 0.6);
      const pos = new THREE.Vector3(
        r * Math.sin(phi) * Math.cos(theta),
        r * Math.sin(phi) * Math.sin(theta),
        r * Math.cos(phi)
      );
      return {
        position: pos.clone(),
        basePosition: pos.clone(),
        velocity: new THREE.Vector3(),
        phase: Math.random() * Math.PI * 2,
        speed: 0.3 + Math.random() * 0.8,
        drift: new THREE.Vector3(
          (Math.random() - 0.5) * 0.15,
          (Math.random() - 0.5) * 0.1,
          (Math.random() - 0.5) * 0.15
        ),
      };
    });
  }

  // Smoothly interpolate activation for transitions
  const activation = useRef(0);

  useFrame((_, delta) => {
    const nodes = nodesRef.current!;
    const now = Date.now() * 0.001;
    const c = new THREE.Color(color);
    const restColor = new THREE.Color("#0a3040");
    const dimLine = new THREE.Color("#082830");

    // Smooth activation transition
    const target_activation = active ? 1 : 0;
    activation.current += (target_activation - activation.current) * delta * 4;
    const a = activation.current;

    const posAttr = pointsGeo.getAttribute("position") as THREE.BufferAttribute;
    const colorAttr = pointsGeo.getAttribute("color") as THREE.BufferAttribute;
    const linePos = linesGeo.getAttribute("position") as THREE.BufferAttribute;
    const lineCol = linesGeo.getAttribute("color") as THREE.BufferAttribute;

    for (let i = 0; i < NODE_COUNT; i++) {
      const node = nodes[i];
      const px = node.basePosition.x + a * Math.sin(now * node.speed + node.phase) * node.drift.x * 4;
      const py = node.basePosition.y + a * Math.cos(now * node.speed * 0.7 + node.phase) * node.drift.y * 4;
      const pz = node.basePosition.z + a * Math.sin(now * node.speed * 1.3 + node.phase + 1) * node.drift.z * 4;
      node.position.set(px, py, pz);
      posAttr.setXYZ(i, px, py, pz);
      const nodeColor = restColor.clone().lerp(c, a);
      colorAttr.setXYZ(i, nodeColor.r, nodeColor.g, nodeColor.b);
    }
    posAttr.needsUpdate = true;
    colorAttr.needsUpdate = true;

    // Draw connections
    let lineIndex = 0;
    for (let i = 0; i < NODE_COUNT; i++) {
      for (let j = i + 1; j < NODE_COUNT; j++) {
        const dist = nodes[i].position.distanceTo(nodes[j].position);
        if (dist < CONNECTION_DIST) {
          const proximity = 1 - dist / CONNECTION_DIST;
          const lineColor = dimLine.clone().lerp(c, proximity * a * 0.85);

          linePos.setXYZ(lineIndex * 2, nodes[i].position.x, nodes[i].position.y, nodes[i].position.z);
          linePos.setXYZ(lineIndex * 2 + 1, nodes[j].position.x, nodes[j].position.y, nodes[j].position.z);
          lineCol.setXYZ(lineIndex * 2, lineColor.r, lineColor.g, lineColor.b);
          lineCol.setXYZ(lineIndex * 2 + 1, lineColor.r, lineColor.g, lineColor.b);
          lineIndex++;
        }
      }
    }
    linePos.needsUpdate = true;
    lineCol.needsUpdate = true;
    linesGeo.setDrawRange(0, lineIndex * 2);
  });

  return (
    <group>
      <points geometry={pointsGeo}>
        <pointsMaterial
          size={0.04}
          vertexColors
          transparent
          opacity={0.9}
          depthWrite={false}
          sizeAttenuation
        />
      </points>
      <lineSegments geometry={linesGeo}>
        <lineBasicMaterial
          vertexColors
          transparent
          opacity={0.7}
          depthWrite={false}
        />
      </lineSegments>
    </group>
  );
}

export function AgentNode({ name, state, hideLabel = false, phaseOffset = 0 }: AgentNodeProps) {
  return (
    <group position={state.position}>
      {/* Mini web around agent */}
      <AgentWeb color={state.color} active={state.speaking} />

      {/* Morphing icon sprite - only morphs when speaking */}
      <MorphingIconSprite scale={0.25} phaseOffset={phaseOffset} speaking={state.speaking} />
    </group>
  );
}
