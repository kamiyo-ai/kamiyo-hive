"use client";

import { useRef, useMemo, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { ActiveEffect, AgentName } from "@/types/agent-events";

const AGENT_POSITIONS: Record<AgentName, [number, number, number]> = {
  kamiyo: [0, 0, -3],
  oracle: [-3, 0, 1],
  sage: [3, 0, 1],
  chaos: [0, 0, 4],
};

const CENTER: [number, number, number] = [0, 0.5, 0];

interface DebateBeamProps {
  effect: ActiveEffect;
}

export function DebateBeam({ effect }: DebateBeamProps) {
  const groupRef = useRef<THREE.Group>(null);
  const lineObjRef = useRef<THREE.Line | null>(null);

  const { start, end, color } = useMemo(() => {
    const src = effect.source ? AGENT_POSITIONS[effect.source] : CENTER;
    return {
      start: new THREE.Vector3(...src),
      end: new THREE.Vector3(...CENTER),
      color: new THREE.Color(effect.color),
    };
  }, [effect.source, effect.color]);

  useEffect(() => {
    if (!groupRef.current) return;

    const mid = new THREE.Vector3()
      .addVectors(start, end)
      .multiplyScalar(0.5)
      .setY(1.5);
    const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
    const points = curve.getPoints(20);
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: 1,
    });

    const line = new THREE.Line(geometry, material);
    groupRef.current.add(line);
    lineObjRef.current = line;

    return () => {
      groupRef.current?.remove(line);
      geometry.dispose();
      material.dispose();
      lineObjRef.current = null;
    };
  }, [start, end, color]);

  useFrame(() => {
    if (!lineObjRef.current) return;
    const mat = lineObjRef.current.material as THREE.LineBasicMaterial;
    mat.opacity = Math.max(0, 1 - effect.progress);
  });

  return <group ref={groupRef} />;
}
