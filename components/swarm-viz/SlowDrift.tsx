'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';

export function SlowDrift() {
  const angleRef = useRef(0);

  useFrame((state, delta) => {
    angleRef.current += delta * 0.05;
    const r = 14;
    state.camera.position.x = Math.sin(angleRef.current) * r;
    state.camera.position.z = Math.cos(angleRef.current) * r;
    state.camera.position.y = 5;
    state.camera.lookAt(0, 0, 0);
  });

  return null;
}
