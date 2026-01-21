'use client';

import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import MagicParticles from './MagicParticles';

interface ParticleSceneProps {
  count?: number;
  onReady?: () => void;
}

export default function ParticleScene({ count = 200, onReady }: ParticleSceneProps) {
  return (
    <Canvas
      style={{ width: '100%', height: '100%', background: 'transparent' }}
      camera={{ position: [0, 0, 300], fov: 50, near: 0.1, far: 1000 }}
      gl={{ antialias: true, alpha: true }}
      onCreated={({ gl }) => {
        gl.setClearColor(0x000000, 0);
        gl.clear();
        if (onReady) onReady();
      }}
    >
      <MagicParticles count={count} />
      <OrbitControls
        enableZoom={false}
        enablePan={true}
        enableRotate={true}
        enableDamping={true}
        dampingFactor={0.05}
        rotateSpeed={0.5}
        panSpeed={0.3}
      />
    </Canvas>
  );
}
