"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { BRAIN_REGIONS, type MemoryCategory, type MemorySummary } from "@/lib/memory-types";

const PARTICLE_COUNT = 2200;
const SPHERE_RADIUS = 2.4;
const REGION_BIAS = 0.55;

interface ParticleData {
  positions: Float32Array;
  colors: Float32Array;
  sizes: Float32Array;
  regions: MemoryCategory[];
}

function buildParticles(): ParticleData {
  const positions = new Float32Array(PARTICLE_COUNT * 3);
  const colors = new Float32Array(PARTICLE_COUNT * 3);
  const sizes = new Float32Array(PARTICLE_COUNT);
  const regions: MemoryCategory[] = [];

  const regionEntries = Object.entries(BRAIN_REGIONS) as Array<
    [MemoryCategory, (typeof BRAIN_REGIONS)[MemoryCategory]]
  >;

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    // Fibonacci sphere for even distribution
    const goldenRatio = (1 + Math.sqrt(5)) / 2;
    const theta = (2 * Math.PI * i) / goldenRatio;
    const phi = Math.acos(1 - (2 * (i + 0.5)) / PARTICLE_COUNT);

    let x = Math.sin(phi) * Math.cos(theta);
    let y = Math.sin(phi) * Math.sin(theta);
    let z = Math.cos(phi);

    // Find nearest region anchor and bias slightly toward it
    let nearest = regionEntries[0]!;
    let nearestDist = Infinity;
    for (const entry of regionEntries) {
      const [, region] = entry;
      const dx = region.anchor[0] - x;
      const dy = region.anchor[1] - y;
      const dz = region.anchor[2] - z;
      const d = dx * dx + dy * dy + dz * dz;
      if (d < nearestDist) {
        nearestDist = d;
        nearest = entry;
      }
    }
    const [category, region] = nearest;
    regions.push(category);

    x = x * (1 - REGION_BIAS * 0.15) + region.anchor[0] * REGION_BIAS * 0.15;
    y = y * (1 - REGION_BIAS * 0.15) + region.anchor[1] * REGION_BIAS * 0.15;
    z = z * (1 - REGION_BIAS * 0.15) + region.anchor[2] * REGION_BIAS * 0.15;

    const len = Math.sqrt(x * x + y * y + z * z);
    x = (x / len) * SPHERE_RADIUS;
    y = (y / len) * SPHERE_RADIUS;
    z = (z / len) * SPHERE_RADIUS;

    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;

    // Amber color with per-region hue shift, plus slight per-particle variance
    const baseHue = region.hue / 360;
    const hue = baseHue + (Math.random() - 0.5) * 0.02;
    const sat = 0.85 + Math.random() * 0.1;
    const light = 0.55 + Math.random() * 0.25;
    const c = new THREE.Color();
    c.setHSL(hue, sat, light);
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;

    sizes[i] = 0.025 + Math.random() * 0.035;
  }

  return { positions, colors, sizes, regions };
}

interface ParticleSphereProps {
  highlightedRegion: MemoryCategory | null;
}

function ParticleSphere({ highlightedRegion }: ParticleSphereProps) {
  const ref = useRef<THREE.Points>(null);
  const { positions, colors, sizes, regions } = useMemo(buildParticles, []);

  // Cache base colors so we can dim/highlight without recomputing
  const baseColors = useMemo(() => colors.slice(), [colors]);

  useFrame((_, delta) => {
    if (!ref.current) return;
    ref.current.rotation.y += delta * 0.05;

    // Update colors based on highlight
    const colorAttr = ref.current.geometry.getAttribute("color") as THREE.BufferAttribute;
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const isHighlighted =
        highlightedRegion === null || regions[i] === highlightedRegion;
      const mul = isHighlighted ? 1.0 : 0.18;
      colorAttr.array[i * 3] = baseColors[i * 3]! * mul;
      colorAttr.array[i * 3 + 1] = baseColors[i * 3 + 1]! * mul;
      colorAttr.array[i * 3 + 2] = baseColors[i * 3 + 2]! * mul;
    }
    colorAttr.needsUpdate = true;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
          count={PARTICLE_COUNT}
        />
        <bufferAttribute
          attach="attributes-color"
          args={[colors, 3]}
          count={PARTICLE_COUNT}
        />
        <bufferAttribute
          attach="attributes-size"
          args={[sizes, 1]}
          count={PARTICLE_COUNT}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.06}
        sizeAttenuation
        vertexColors
        transparent
        opacity={0.95}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
}

function ConnectionLines() {
  // Faint web of lines between nearby region anchors
  const lineGeometry = useMemo(() => {
    const positions: number[] = [];
    const entries = Object.values(BRAIN_REGIONS);
    for (let i = 0; i < entries.length; i++) {
      for (let j = i + 1; j < entries.length; j++) {
        const a = entries[i]!.anchor;
        const b = entries[j]!.anchor;
        positions.push(
          a[0] * SPHERE_RADIUS, a[1] * SPHERE_RADIUS, a[2] * SPHERE_RADIUS,
          b[0] * SPHERE_RADIUS, b[1] * SPHERE_RADIUS, b[2] * SPHERE_RADIUS,
        );
      }
    }
    const geom = new THREE.BufferGeometry();
    geom.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3),
    );
    return geom;
  }, []);

  return (
    <lineSegments geometry={lineGeometry}>
      <lineBasicMaterial
        color="#FFA940"
        transparent
        opacity={0.08}
        blending={THREE.AdditiveBlending}
      />
    </lineSegments>
  );
}

export interface BrainProps {
  memories: MemorySummary[];
  onRegionHover?: (region: MemoryCategory | null) => void;
}

export function Brain({ memories, onRegionHover }: BrainProps) {
  const [highlighted, setHighlighted] = useState<MemoryCategory | null>(null);

  const regionCounts = useMemo(() => {
    const counts: Partial<Record<MemoryCategory, number>> = {};
    for (const m of memories) {
      counts[m.category] = (counts[m.category] ?? 0) + 1;
    }
    return counts;
  }, [memories]);

  return (
    <div className="relative h-full w-full">
      <Canvas
        camera={{ position: [0, 0, 7], fov: 45 }}
        gl={{ antialias: true, alpha: false }}
        style={{ background: "#1a1a1a" }}
      >
        <ambientLight intensity={0.4} />
        <ParticleSphere highlightedRegion={highlighted} />
        <ConnectionLines />
        <OrbitControls
          enablePan={false}
          enableZoom
          autoRotate={highlighted === null}
          autoRotateSpeed={0.4}
          minDistance={4}
          maxDistance={12}
        />
      </Canvas>

      {/* Region label overlay (hover targets — clickable for v0.1, gesture-driven in v0.2) */}
      <div className="pointer-events-none absolute inset-0 flex items-end justify-center pb-6">
        <div className="pointer-events-auto flex gap-2 rounded-full bg-charcoal-800/80 px-3 py-2 text-xs backdrop-blur">
          {(Object.entries(BRAIN_REGIONS) as Array<
            [MemoryCategory, (typeof BRAIN_REGIONS)[MemoryCategory]]
          >).map(([cat, region]) => (
            <button
              key={cat}
              data-region={cat}
              className={`rounded-full px-3 py-1 transition-all ${
                highlighted === cat
                  ? "bg-amber-core text-charcoal-900"
                  : "bg-charcoal-700/60 text-amber-glow hover:bg-charcoal-600"
              }`}
              onMouseEnter={() => {
                setHighlighted(cat);
                onRegionHover?.(cat);
              }}
              onMouseLeave={() => {
                setHighlighted(null);
                onRegionHover?.(null);
              }}
            >
              {region.label}
              <span className="ml-1 opacity-60">
                {regionCounts[cat] ?? 0}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
