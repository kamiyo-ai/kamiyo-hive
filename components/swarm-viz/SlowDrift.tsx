'use client';

import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';

const ORBIT_RADIUS = 14;
const ORBIT_HEIGHT = 5;
const ORBIT_SPEED = 0.05;

export function SlowDrift() {
  const angle = useRef(0);
  const { camera } = useThree();

  useFrame((_, delta) => {
    angle.current += delta * ORBIT_SPEED;
    camera.position.x = Math.sin(angle.current) * ORBIT_RADIUS;
    camera.position.z = Math.cos(angle.current) * ORBIT_RADIUS;
    camera.position.y = ORBIT_HEIGHT;
    camera.lookAt(0, 0, 0);
  });

  return null;
}
