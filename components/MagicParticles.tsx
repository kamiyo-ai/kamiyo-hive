'use client';

import { useMemo, useRef, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// Icon patterns - exact coordinates from SVG files
// Using normalized 20x16 coordinate space
const ICONS = [
  // Agreement - two overlapping blocks (top-left and bottom-right)
  {
    cells: [
      [2.4, 3.4],
      [4.4, 3.4],
      [6.4, 3.4],
      [8.4, 3.4],
      [2.4, 5.4],
      [4.4, 5.4],
      [6.4, 5.4],
      [8.4, 5.4],
      [2.4, 7.4],
      [4.4, 7.4],
      [6.4, 7.4],
      [8.4, 7.4],
      [9.6, 8.6],
      [11.6, 8.6],
      [13.6, 8.6],
      [15.6, 8.6],
      [9.6, 10.6],
      [11.6, 10.6],
      [13.6, 10.6],
      [15.6, 10.6],
      [9.6, 12.6],
      [11.6, 12.6],
      [13.6, 12.6],
      [15.6, 12.6],
    ],
  },
  // Delivered - hourglass/bowtie shape
  {
    cells: [
      [7.4, 3.4],
      [9.4, 3.4],
      [7.4, 5.4],
      [9.4, 5.4],
      [3.4, 7.4],
      [5.4, 7.4],
      [11.4, 7.4],
      [13.4, 7.4],
      [3.4, 9.4],
      [5.4, 9.4],
      [11.4, 9.4],
      [13.4, 9.4],
      [7.4, 11.4],
      [9.4, 11.4],
      [7.4, 13.4],
      [9.4, 13.4],
    ],
  },
  // Oracle - symmetric H pattern
  {
    cells: [
      [5.4, 3.4],
      [7.4, 3.4],
      [11.4, 3.4],
      [13.4, 3.4],
      [5.4, 5.4],
      [7.4, 5.4],
      [11.4, 5.4],
      [13.4, 5.4],
      [2.4, 7.4],
      [4.4, 7.4],
      [8.4, 7.4],
      [10.4, 7.4],
      [14.4, 7.4],
      [16.4, 7.4],
      [2.4, 9.4],
      [4.4, 9.4],
      [8.4, 9.4],
      [10.4, 9.4],
      [14.4, 9.4],
      [16.4, 9.4],
      [5.4, 11.4],
      [7.4, 11.4],
      [11.4, 11.4],
      [13.4, 11.4],
      [5.4, 13.4],
      [7.4, 13.4],
      [11.4, 13.4],
      [13.4, 13.4],
    ],
  },
  // Settlement - wide grid with gaps
  {
    cells: [
      [3.4, 3.4],
      [5.4, 3.4],
      [7.4, 3.4],
      [9.4, 3.4],
      [11.4, 3.4],
      [13.4, 3.4],
      [15.4, 3.4],
      [17.4, 3.4],
      [3.4, 5.4],
      [5.4, 5.4],
      [7.4, 5.4],
      [9.4, 5.4],
      [11.4, 5.4],
      [13.4, 5.4],
      [15.4, 5.4],
      [17.4, 5.4],
      [1.4, 7.4],
      [3.4, 7.4],
      [9.4, 7.4],
      [11.4, 7.4],
      [17.4, 7.4],
      [19.4, 7.4],
      [1.4, 9.4],
      [3.4, 9.4],
      [9.4, 9.4],
      [11.4, 9.4],
      [17.4, 9.4],
      [19.4, 9.4],
      [3.4, 11.4],
      [5.4, 11.4],
      [7.4, 11.4],
      [9.4, 11.4],
      [11.4, 11.4],
      [13.4, 11.4],
      [15.4, 11.4],
      [17.4, 11.4],
      [3.4, 13.4],
      [5.4, 13.4],
      [7.4, 13.4],
      [9.4, 13.4],
      [11.4, 13.4],
      [13.4, 13.4],
      [15.4, 13.4],
      [17.4, 13.4],
    ],
  },
];

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

// Find closest cell in target array to minimize travel distance
function findClosestCell(targetCells: number[][], fromX: number, fromY: number, usedIndices: Set<number>) {
  let minDist = Infinity;
  let bestIndex = -1;

  for (let i = 0; i < targetCells.length; i++) {
    if (usedIndices.has(i)) continue;
    const [tx, ty] = targetCells[i];
    const dist = Math.sqrt((tx - fromX) ** 2 + (ty - fromY) ** 2);
    if (dist < minDist) {
      minDist = dist;
      bestIndex = i;
    }
  }
  return bestIndex;
}

// Pre-compute optimal cell mappings between consecutive icons
function computeMorphMappings() {
  const mappings: { from: number[]; to: number[] }[][] = [];

  for (let i = 0; i < ICONS.length; i++) {
    const nextIndex = (i + 1) % ICONS.length;
    const currentCells = ICONS[i].cells;
    const nextCells = ICONS[nextIndex].cells;

    const mapping: { from: number[]; to: number[] }[] = [];
    const usedNext = new Set<number>();

    // For each current cell, find closest next cell
    for (let j = 0; j < currentCells.length; j++) {
      const [cx, cy] = currentCells[j];
      const bestNext = findClosestCell(nextCells, cx, cy, usedNext);
      if (bestNext !== -1) {
        usedNext.add(bestNext);
        mapping.push({
          from: [cx, cy],
          to: nextCells[bestNext],
        });
      } else {
        // No available next cell, morph to center
        mapping.push({
          from: [cx, cy],
          to: [10, 8], // center point
        });
      }
    }

    // Handle extra cells in next icon (spawn from center)
    for (let j = 0; j < nextCells.length; j++) {
      if (!usedNext.has(j)) {
        mapping.push({
          from: [10, 8], // spawn from center
          to: nextCells[j],
        });
      }
    }

    mappings.push(mapping);
  }

  return mappings;
}

const MORPH_MAPPINGS = computeMorphMappings();

function drawMorphedIcon(ctx: CanvasRenderingContext2D, size: number, progress: number) {
  // Each icon cycle: 70% hold, 30% morph
  const holdRatio = 0.7;
  const morphRatio = 0.3;

  const cycleProgress = (progress * 4) % 1;
  const iconIndex = Math.floor(progress * 4) % 4;

  let t: number;
  if (cycleProgress < holdRatio) {
    t = 0;
  } else {
    const morphProgress = (cycleProgress - holdRatio) / morphRatio;
    t = morphProgress * morphProgress * (3 - 2 * morphProgress); // smoothstep
  }

  const scale = size / 22;
  const cellSize = 1.8 * scale;

  const gradient = ctx.createLinearGradient(0, 0, size, size);
  gradient.addColorStop(0, '#00ffff');
  gradient.addColorStop(1, '#ff00ff');
  ctx.fillStyle = gradient;

  if (t === 0) {
    // Hold phase - draw current icon cells directly
    const currentCells = ICONS[iconIndex].cells;
    currentCells.forEach(([x, y]) => {
      ctx.fillRect(x * scale, y * scale, cellSize, cellSize);
    });
  } else {
    // Morph phase - interpolate positions
    const mapping = MORPH_MAPPINGS[iconIndex];
    mapping.forEach(({ from, to }) => {
      const x = lerp(from[0], to[0], t);
      const y = lerp(from[1], to[1], t);
      ctx.fillRect(x * scale, y * scale, cellSize, cellSize);
    });
  }
}

const NUM_PHASES = 16; // Number of different animation phases

const INTRO_DURATION = 2; // seconds for all particles to appear

interface Particle {
  position: [number, number, number];
  scale: number;
  phaseOffset: number;
  appearTime: number;
}

export default function MagicParticles({ count = 500 }: { count?: number }) {
  const groupRef = useRef<THREE.Group>(null);
  const [textures, setTextures] = useState<THREE.CanvasTexture[]>([]);
  const canvasesRef = useRef<HTMLCanvasElement[]>([]);
  const progressRef = useRef(0);
  const introTimeRef = useRef(0);
  const materialsRef = useRef<(THREE.SpriteMaterial | null)[]>([]);

  useEffect(() => {
    const canvases: HTMLCanvasElement[] = [];
    const texs: THREE.CanvasTexture[] = [];

    for (let i = 0; i < NUM_PHASES; i++) {
      const canvas = document.createElement('canvas');
      canvas.width = 128;
      canvas.height = 128;
      canvases.push(canvas);

      const ctx = canvas.getContext('2d');
      if (ctx) {
        const phase = i / NUM_PHASES;
        drawMorphedIcon(ctx, 128, phase);
      }

      const tex = new THREE.CanvasTexture(canvas);
      tex.minFilter = THREE.LinearFilter;
      tex.magFilter = THREE.LinearFilter;
      texs.push(tex);
    }

    canvasesRef.current = canvases;
    setTextures(texs);
  }, []);

  const particles = useMemo<Particle[]>(() => {
    const arr: Particle[] = [];
    for (let i = 0; i < count; i++) {
      arr.push({
        position: [(Math.random() - 0.5) * 400, (Math.random() - 0.5) * 250, (Math.random() - 0.5) * 300],
        scale: (2 + Math.random() * 2) * 1.1,
        phaseOffset: Math.random(),
        appearTime: Math.random() * INTRO_DURATION, // When this particle appears
      });
    }
    return arr;
  }, [count]);

  useFrame((state, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += 0.0005;
      groupRef.current.rotation.x += 0.0002;
    }

    // Track intro animation time
    if (introTimeRef.current < INTRO_DURATION + 0.5) {
      introTimeRef.current += delta;

      // Update material opacities during intro
      materialsRef.current.forEach((mat, i) => {
        if (mat) {
          const particle = particles[i];
          const timeSinceAppear = introTimeRef.current - particle.appearTime;
          if (timeSinceAppear <= 0) {
            mat.opacity = 0;
          } else if (timeSinceAppear < 0.3) {
            mat.opacity = (timeSinceAppear / 0.3) * 0.95;
          } else {
            mat.opacity = 0.95;
          }
        }
      });
    }

    if (textures.length === NUM_PHASES && canvasesRef.current.length === NUM_PHASES) {
      progressRef.current += delta * 0.08;
      if (progressRef.current >= 1) progressRef.current = 0;

      // Update all phase textures
      for (let i = 0; i < NUM_PHASES; i++) {
        const phase = (progressRef.current + i / NUM_PHASES) % 1;
        const ctx = canvasesRef.current[i].getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, 128, 128);
          drawMorphedIcon(ctx, 128, phase);
          textures[i].needsUpdate = true;
        }
      }
    }
  });

  if (textures.length !== NUM_PHASES) return null;

  return (
    <group ref={groupRef}>
      {particles.map((particle, i) => {
        const textureIndex = Math.floor(particle.phaseOffset * NUM_PHASES);
        return (
          <sprite key={i} position={particle.position} scale={[particle.scale, particle.scale, 1]}>
            <spriteMaterial
              ref={(el) => {
                materialsRef.current[i] = el;
              }}
              map={textures[textureIndex]}
              transparent
              opacity={0}
              depthWrite={false}
            />
          </sprite>
        );
      })}
    </group>
  );
}
