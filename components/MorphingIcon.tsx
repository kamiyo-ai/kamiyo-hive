"use client";
import { useEffect, useRef } from "react";

type Cell = [number, number];
type Icon = { cells: Cell[] };
type MorphMapping = { from: Cell; to: Cell };

const ICONS: Icon[] = [
    // Agreement - two overlapping blocks
    { cells: [
        [2.4,3.4],[4.4,3.4],[6.4,3.4],[8.4,3.4],
        [2.4,5.4],[4.4,5.4],[6.4,5.4],[8.4,5.4],
        [2.4,7.4],[4.4,7.4],[6.4,7.4],[8.4,7.4],
        [9.6,8.6],[11.6,8.6],[13.6,8.6],[15.6,8.6],
        [9.6,10.6],[11.6,10.6],[13.6,10.6],[15.6,10.6],
        [9.6,12.6],[11.6,12.6],[13.6,12.6],[15.6,12.6],
    ]},
    // Delivered - hourglass/bowtie shape
    { cells: [
        [7.4,3.4],[9.4,3.4],
        [7.4,5.4],[9.4,5.4],
        [3.4,7.4],[5.4,7.4],[11.4,7.4],[13.4,7.4],
        [3.4,9.4],[5.4,9.4],[11.4,9.4],[13.4,9.4],
        [7.4,11.4],[9.4,11.4],
        [7.4,13.4],[9.4,13.4],
    ]},
    // Oracle - symmetric H pattern
    { cells: [
        [5.4,3.4],[7.4,3.4],[11.4,3.4],[13.4,3.4],
        [5.4,5.4],[7.4,5.4],[11.4,5.4],[13.4,5.4],
        [2.4,7.4],[4.4,7.4],[8.4,7.4],[10.4,7.4],[14.4,7.4],[16.4,7.4],
        [2.4,9.4],[4.4,9.4],[8.4,9.4],[10.4,9.4],[14.4,9.4],[16.4,9.4],
        [5.4,11.4],[7.4,11.4],[11.4,11.4],[13.4,11.4],
        [5.4,13.4],[7.4,13.4],[11.4,13.4],[13.4,13.4],
    ]},
    // Settlement - wide grid with gaps
    { cells: [
        [3.4,3.4],[5.4,3.4],[7.4,3.4],[9.4,3.4],[11.4,3.4],[13.4,3.4],[15.4,3.4],[17.4,3.4],
        [3.4,5.4],[5.4,5.4],[7.4,5.4],[9.4,5.4],[11.4,5.4],[13.4,5.4],[15.4,5.4],[17.4,5.4],
        [1.4,7.4],[3.4,7.4],[9.4,7.4],[11.4,7.4],[17.4,7.4],[19.4,7.4],
        [1.4,9.4],[3.4,9.4],[9.4,9.4],[11.4,9.4],[17.4,9.4],[19.4,9.4],
        [3.4,11.4],[5.4,11.4],[7.4,11.4],[9.4,11.4],[11.4,11.4],[13.4,11.4],[15.4,11.4],[17.4,11.4],
        [3.4,13.4],[5.4,13.4],[7.4,13.4],[9.4,13.4],[11.4,13.4],[13.4,13.4],[15.4,13.4],[17.4,13.4],
    ]},
];

function lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
}

function findClosestCell(targetCells: Cell[], fromX: number, fromY: number, usedIndices: Set<number>): number {
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

function computeMorphMappings(): MorphMapping[][] {
    const mappings: MorphMapping[][] = [];

    for (let i = 0; i < ICONS.length; i++) {
        const nextIndex = (i + 1) % ICONS.length;
        const currentCells = ICONS[i].cells;
        const nextCells = ICONS[nextIndex].cells;

        const mapping: MorphMapping[] = [];
        const usedNext = new Set<number>();

        for (let j = 0; j < currentCells.length; j++) {
            const [cx, cy] = currentCells[j];
            const bestNext = findClosestCell(nextCells, cx, cy, usedNext);
            if (bestNext !== -1) {
                usedNext.add(bestNext);
                mapping.push({ from: [cx, cy], to: nextCells[bestNext] });
            } else {
                mapping.push({ from: [cx, cy], to: [10, 8] });
            }
        }

        for (let j = 0; j < nextCells.length; j++) {
            if (!usedNext.has(j)) {
                mapping.push({ from: [10, 8], to: nextCells[j] });
            }
        }

        mappings.push(mapping);
    }

    return mappings;
}

const MORPH_MAPPINGS = computeMorphMappings();

function drawMorphedIcon(ctx: CanvasRenderingContext2D, size: number, progress: number): void {
    const holdRatio = 0.7;
    const morphRatio = 0.3;

    const cycleProgress = (progress * 4) % 1;
    const iconIndex = Math.floor(progress * 4) % 4;

    let t: number;
    if (cycleProgress < holdRatio) {
        t = 0;
    } else {
        const morphProgress = (cycleProgress - holdRatio) / morphRatio;
        t = morphProgress * morphProgress * (3 - 2 * morphProgress);
    }

    const scale = size / 22;
    const cellSize = 1.2 * scale;

    const gradient = ctx.createLinearGradient(0, 0, size, size);
    gradient.addColorStop(0, '#00f0ff');
    gradient.addColorStop(1, '#ff44f5');
    ctx.fillStyle = gradient;

    if (t === 0) {
        const currentCells = ICONS[iconIndex].cells;
        currentCells.forEach(([x, y]) => {
            ctx.fillRect(x * scale, y * scale, cellSize, cellSize);
        });
    } else {
        const mapping = MORPH_MAPPINGS[iconIndex];
        mapping.forEach(({ from, to }) => {
            const x = lerp(from[0], to[0], t);
            const y = lerp(from[1], to[1], t);
            ctx.fillRect(x * scale, y * scale, cellSize, cellSize);
        });
    }
}

interface MorphingIconProps {
    size?: number;
    className?: string;
    paused?: boolean;
}

export default function MorphingIcon({ size = 64, className = "", paused = false }: MorphingIconProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const progressRef = useRef(0);
    const rafRef = useRef<number | null>(null);
    const pausedRef = useRef(paused);

    useEffect(() => {
        pausedRef.current = paused;
    }, [paused]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const dpr = window.devicePixelRatio || 1;
        canvas.width = size * dpr;
        canvas.height = size * dpr;
        ctx.scale(dpr, dpr);

        let lastTime = performance.now();

        const animate = (now: number) => {
            const delta = (now - lastTime) / 1000;
            lastTime = now;

            if (!pausedRef.current) {
                progressRef.current += delta * 0.08;
                if (progressRef.current >= 1) progressRef.current = 0;
            }

            ctx.clearRect(0, 0, size, size);
            drawMorphedIcon(ctx, size, progressRef.current);

            rafRef.current = requestAnimationFrame(animate);
        };

        rafRef.current = requestAnimationFrame(animate);

        return () => {
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
        };
    }, [size]);

    return (
        <canvas
            ref={canvasRef}
            className={className}
            style={{ width: size, height: size }}
        />
    );
}
