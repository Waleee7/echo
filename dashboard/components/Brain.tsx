"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Html, OrbitControls } from "@react-three/drei";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import {
  BRAIN_REGIONS,
  type MemoryCategory,
  type MemorySummary,
} from "@/lib/memory-types";
import { Legend } from "./Legend";

const AMBIENT_COUNT = 700;
const SPHERE_RADIUS = 2.4;
const MEMORY_DOT_RADIUS = 0.075;

// Module-level registry of memory-dot meshes — the raycaster only checks
// these, not the 700-particle ambient sphere or HUD elements.
const memoryDotRegistry = new Set<THREE.Object3D>();

interface AmbientData {
  positions: Float32Array;
  colors: Float32Array;
}

function buildAmbient(): AmbientData {
  const positions = new Float32Array(AMBIENT_COUNT * 3);
  const colors = new Float32Array(AMBIENT_COUNT * 3);
  const golden = (1 + Math.sqrt(5)) / 2;
  for (let i = 0; i < AMBIENT_COUNT; i++) {
    const theta = (2 * Math.PI * i) / golden;
    const phi = Math.acos(1 - (2 * (i + 0.5)) / AMBIENT_COUNT);
    const x = Math.sin(phi) * Math.cos(theta) * SPHERE_RADIUS;
    const y = Math.sin(phi) * Math.sin(theta) * SPHERE_RADIUS;
    const z = Math.cos(phi) * SPHERE_RADIUS;
    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;

    // Jarvis cyan with subtle variance
    const hue = 0.55 + (Math.random() - 0.5) * 0.04;
    const sat = 0.7 + Math.random() * 0.2;
    const light = 0.45 + Math.random() * 0.2;
    const c = new THREE.Color().setHSL(hue, sat, light);
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  return { positions, colors };
}

function hashStringToFloat(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 0xffffffff;
}

function memoryPosition(
  memoryId: string,
  category: MemoryCategory,
): [number, number, number] {
  const anchor = BRAIN_REGIONS[category].anchor;
  // Deterministic jitter from the id
  const r1 = hashStringToFloat(memoryId + "x");
  const r2 = hashStringToFloat(memoryId + "y");
  const jitterScale = 0.5;
  const jx = (r1 - 0.5) * jitterScale;
  const jy = (r2 - 0.5) * jitterScale;
  const jz = (hashStringToFloat(memoryId + "z") - 0.5) * jitterScale;

  let x = anchor[0] + jx;
  let y = anchor[1] + jy;
  let z = anchor[2] + jz;
  const len = Math.sqrt(x * x + y * y + z * z) || 1;
  x = (x / len) * SPHERE_RADIUS;
  y = (y / len) * SPHERE_RADIUS;
  z = (z / len) * SPHERE_RADIUS;
  return [x, y, z];
}

function AmbientSphere({
  highlighted,
}: {
  highlighted: MemoryCategory | null;
}) {
  const ref = useRef<THREE.Points>(null);
  const { positions, colors } = useMemo(buildAmbient, []);
  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += delta * 0.04;
  });
  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
          count={AMBIENT_COUNT}
        />
        <bufferAttribute
          attach="attributes-color"
          args={[colors, 3]}
          count={AMBIENT_COUNT}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.035}
        sizeAttenuation
        vertexColors
        transparent
        opacity={highlighted ? 0.18 : 0.55}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
}

function MemoryDot({
  memory,
  onSelect,
  isSelected,
  isDimmed,
}: {
  memory: MemorySummary;
  onSelect: (id: string) => void;
  isSelected: boolean;
  isDimmed: boolean;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const pos = useMemo(
    () => memoryPosition(memory.id, memory.category),
    [memory.id, memory.category],
  );

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    // Subtle pulse driven by freshness — fresher memories breathe faster
    const speed = 0.6 + memory.freshness * 1.2;
    const pulse = 1 + Math.sin(clock.elapsedTime * speed + pos[0]) * 0.12;
    const scale = (isSelected ? 1.7 : hovered ? 1.4 : 1) * pulse;
    meshRef.current.scale.setScalar(scale);
  });

  // Register / unregister this dot in the raycast pool
  useEffect(() => {
    const node = meshRef.current;
    if (!node) return;
    memoryDotRegistry.add(node);
    return () => {
      memoryDotRegistry.delete(node);
    };
  }, []);

  const baseOpacity = isDimmed ? 0.25 : 1;
  const regionHue = BRAIN_REGIONS[memory.category].hue / 360;
  const color = useMemo(
    () =>
      new THREE.Color().setHSL(
        regionHue,
        0.75,
        isSelected ? 0.78 : hovered ? 0.68 : 0.6,
      ),
    [regionHue, isSelected, hovered],
  );

  return (
    <mesh
      ref={meshRef}
      position={pos}
      userData={{ memoryId: memory.id }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        setHovered(false);
        document.body.style.cursor = "auto";
      }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(memory.id);
      }}
    >
      <sphereGeometry args={[MEMORY_DOT_RADIUS, 16, 16]} />
      <meshBasicMaterial
        color={color}
        transparent
        opacity={baseOpacity}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
      {(hovered || isSelected) && (
        <Html
          center
          distanceFactor={8}
          style={{ pointerEvents: "none" }}
          position={[0, MEMORY_DOT_RADIUS * 2.4, 0]}
        >
          <div className="whitespace-nowrap rounded border border-amber-core/40 bg-charcoal-800/90 px-2 py-1 text-xs text-amber-glow shadow-[0_0_18px_rgba(79,195,255,0.35)]">
            {memory.title}
          </div>
        </Html>
      )}
    </mesh>
  );
}

function GestureRaycaster({ onPick }: { onPick: (id: string) => void }) {
  const { camera, gl } = useThree();
  useEffect(() => {
    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    let lastHoverId: string | null = null;

    function raycastAt(
      clientX: number,
      clientY: number,
    ): string | null {
      const rect = gl.domElement.getBoundingClientRect();
      if (
        clientX < rect.left ||
        clientX > rect.right ||
        clientY < rect.top ||
        clientY > rect.bottom
      ) {
        return null;
      }
      ndc.set(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        -((clientY - rect.top) / rect.height) * 2 + 1,
      );
      raycaster.setFromCamera(ndc, camera);
      const targets = Array.from(memoryDotRegistry);
      if (targets.length === 0) return null;
      const hits = raycaster.intersectObjects(targets, false);
      return hits[0]
        ? (hits[0].object.userData.memoryId as string)
        : null;
    }

    const onPinch = (e: Event) => {
      const d = (e as CustomEvent<{ x: number; y: number }>).detail;
      const id = raycastAt(d.x, d.y);
      if (id) onPick(id);
    };

    const onCursor = (e: Event) => {
      const d = (e as CustomEvent<{ x: number; y: number }>).detail;
      const id = raycastAt(d.x, d.y);
      if (id !== lastHoverId) {
        lastHoverId = id;
        window.dispatchEvent(
          new CustomEvent("echo-hover", { detail: { memoryId: id } }),
        );
      }
    };

    window.addEventListener("echo-pinch", onPinch as EventListener);
    window.addEventListener("echo-cursor", onCursor as EventListener);
    return () => {
      window.removeEventListener("echo-pinch", onPinch as EventListener);
      window.removeEventListener("echo-cursor", onCursor as EventListener);
    };
  }, [camera, gl, onPick]);
  return null;
}

function RelationEdges({
  memories,
  selectedId,
}: {
  memories: MemorySummary[];
  selectedId: string | null;
}) {
  const { ambientGeom, hotGeom } = useMemo(() => {
    const ambientPositions: number[] = [];
    const hotPositions: number[] = [];
    const ids = new Set(memories.map((m) => m.id));
    const seen = new Set<string>();
    for (const m of memories) {
      for (const rid of m.relatedIds ?? []) {
        if (!ids.has(rid)) continue;
        const key = m.id < rid ? `${m.id}|${rid}` : `${rid}|${m.id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const other = memories.find((mm) => mm.id === rid);
        if (!other) continue;
        const a = memoryPosition(m.id, m.category);
        const b = memoryPosition(other.id, other.category);
        const isHot =
          selectedId !== null &&
          (m.id === selectedId || rid === selectedId);
        const target = isHot ? hotPositions : ambientPositions;
        target.push(a[0], a[1], a[2], b[0], b[1], b[2]);
      }
    }
    const ag = new THREE.BufferGeometry();
    ag.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(ambientPositions, 3),
    );
    const hg = new THREE.BufferGeometry();
    hg.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(hotPositions, 3),
    );
    return { ambientGeom: ag, hotGeom: hg };
  }, [memories, selectedId]);

  const hotMatRef = useRef<THREE.LineBasicMaterial>(null);
  useFrame(({ clock }) => {
    if (hotMatRef.current) {
      hotMatRef.current.opacity =
        0.55 + Math.sin(clock.elapsedTime * 2.2) * 0.25;
    }
  });

  return (
    <>
      {ambientGeom.attributes.position?.count > 0 && (
        <lineSegments geometry={ambientGeom}>
          <lineBasicMaterial
            color="#4FC3FF"
            transparent
            opacity={selectedId ? 0.08 : 0.22}
            blending={THREE.AdditiveBlending}
          />
        </lineSegments>
      )}
      {hotGeom.attributes.position?.count > 0 && (
        <lineSegments geometry={hotGeom}>
          <lineBasicMaterial
            ref={hotMatRef}
            color="#FFD080"
            transparent
            opacity={0.7}
            linewidth={2}
            blending={THREE.AdditiveBlending}
          />
        </lineSegments>
      )}
    </>
  );
}

function ArcReactor({ engaged }: { engaged: boolean }) {
  const outerRef = useRef<THREE.Mesh>(null);
  const innerRef = useRef<THREE.Mesh>(null);
  useFrame((_, delta) => {
    if (outerRef.current) outerRef.current.rotation.z += delta * 0.12;
    if (innerRef.current) innerRef.current.rotation.z -= delta * 0.2;
  });
  const intensity = engaged ? 0.35 : 0.6;
  return (
    <group>
      <mesh ref={outerRef} rotation={[Math.PI / 2.5, 0, 0]}>
        <ringGeometry args={[0.55, 0.6, 64, 1]} />
        <meshBasicMaterial
          color="#4FC3FF"
          transparent
          opacity={intensity}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      <mesh ref={innerRef} rotation={[Math.PI / 2.5, 0, 0]}>
        <ringGeometry args={[0.35, 0.38, 48, 1]} />
        <meshBasicMaterial
          color="#9DDCFF"
          transparent
          opacity={intensity * 0.7}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      {/* Soft core glow */}
      <mesh>
        <sphereGeometry args={[0.18, 16, 16]} />
        <meshBasicMaterial
          color="#9DDCFF"
          transparent
          opacity={intensity * 0.5}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

export interface BrainProps {
  memories: MemorySummary[];
  selectedId: string | null;
  highlightedRegion: MemoryCategory | null;
  onSelectMemory: (id: string) => void;
  onRegionHover?: (region: MemoryCategory | null) => void;
}

export function Brain({
  memories,
  selectedId,
  highlightedRegion,
  onSelectMemory,
  onRegionHover,
}: BrainProps) {
  const orbitRef = useRef<OrbitControlsImpl | null>(null);
  const regionCounts = useMemo(() => {
    const counts: Partial<Record<MemoryCategory, number>> = {};
    for (const m of memories) {
      counts[m.category] = (counts[m.category] ?? 0) + 1;
    }
    return counts;
  }, [memories]);

  const isEngaged = highlightedRegion !== null || selectedId !== null;

  return (
    <div className="relative h-full w-full">
      <Canvas
        camera={{ position: [0, 0, 7], fov: 45 }}
        gl={{ antialias: true, alpha: false }}
        style={{ background: "#050b14" }}
      >
        <ambientLight intensity={0.4} />
        <AmbientSphere highlighted={highlightedRegion} />
        <ArcReactor engaged={isEngaged} />
        <RelationEdges memories={memories} selectedId={selectedId} />
        <GestureRaycaster onPick={onSelectMemory} />
        {memories.map((m) => (
          <MemoryDot
            key={m.id}
            memory={m}
            onSelect={onSelectMemory}
            isSelected={selectedId === m.id}
            isDimmed={
              highlightedRegion !== null && m.category !== highlightedRegion
            }
          />
        ))}
        <OrbitControls
          ref={orbitRef}
          enablePan={false}
          enableZoom
          autoRotate
          autoRotateSpeed={isEngaged ? 0.1 : 0.35}
          minDistance={4}
          maxDistance={12}
        />
      </Canvas>

      {/* Subtle scanline overlay for the HUD feel */}
      <div className="pointer-events-none absolute inset-0 hud-scanlines z-10" />

      {/* HUD corner brackets — Jarvis viewport markers */}
      <HudBrackets />

      {/* Always-visible compact shortcuts legend */}
      <Legend />

      {/* Status ticker bottom-left */}
      <div className="pointer-events-none absolute bottom-6 left-4 z-20 font-mono text-[10px] uppercase tracking-[0.2em] text-amber-glow/40">
        ECHO :: {memories.length} {memories.length === 1 ? "node" : "nodes"}
        {" :: "}
        {selectedId
          ? "focus"
          : highlightedRegion
            ? `scan ${highlightedRegion}`
            : "standby"}
      </div>

      <button
        onClick={() => orbitRef.current?.reset()}
        title="Reset camera"
        className="absolute right-4 top-4 z-30 rounded-full border border-charcoal-600 bg-charcoal-800/80 px-3 py-1.5 text-xs text-amber-glow hover:bg-charcoal-700"
      >
        ⌂ Reset view
      </button>

      {memories.length === 0 && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="rounded-lg border border-amber-core/30 bg-charcoal-800/80 px-4 py-3 text-center text-sm text-amber-glow">
            <div className="font-semibold">No memories yet</div>
            <div className="mt-1 text-xs text-amber-glow/60">
              Ask Sage to save one. Your brain populates as you remember.
            </div>
          </div>
        </div>
      )}

      {/* Region label bar */}
      <div className="pointer-events-none absolute inset-0 flex items-end justify-center pb-6">
        <div className="pointer-events-auto flex gap-2 rounded-full bg-charcoal-800/80 px-3 py-2 text-xs backdrop-blur">
          {(Object.entries(BRAIN_REGIONS) as Array<
            [MemoryCategory, (typeof BRAIN_REGIONS)[MemoryCategory]]
          >).map(([cat, region]) => {
            const count = regionCounts[cat] ?? 0;
            const isActive = highlightedRegion === cat;
            const accent = `hsl(${region.hue} 80% 65%)`;
            return (
              <button
                key={cat}
                data-region={cat}
                disabled={count === 0}
                style={{
                  borderLeft: `3px solid ${accent}`,
                  ...(isActive
                    ? { background: accent, color: "#050b14" }
                    : {}),
                }}
                className={`rounded-full px-3 py-1 transition-all ${
                  isActive
                    ? ""
                    : count === 0
                      ? "bg-charcoal-700/30 text-amber-glow/30"
                      : "bg-charcoal-700/60 text-amber-glow hover:bg-charcoal-600"
                }`}
                onMouseEnter={() => onRegionHover?.(cat)}
                onMouseLeave={() => onRegionHover?.(null)}
              >
                {region.label}
                <span className="ml-1 opacity-60">{count}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function HudBrackets() {
  const stroke = "rgba(79, 195, 255, 0.55)";
  const size = 22;
  const filter = "drop-shadow(0 0 4px rgba(79, 195, 255, 0.45))";
  // Each corner is a small L-shape SVG. Subtle, Jarvis-y.
  return (
    <div className="pointer-events-none absolute inset-3 z-20">
      {/* top-left */}
      <svg
        className="absolute left-0 top-0"
        width={size}
        height={size}
        style={{ filter }}
      >
        <path
          d={`M 0 ${size} L 0 0 L ${size} 0`}
          fill="none"
          stroke={stroke}
          strokeWidth="1.5"
        />
      </svg>
      {/* top-right */}
      <svg
        className="absolute right-0 top-0"
        width={size}
        height={size}
        style={{ filter }}
      >
        <path
          d={`M 0 0 L ${size} 0 L ${size} ${size}`}
          fill="none"
          stroke={stroke}
          strokeWidth="1.5"
        />
      </svg>
      {/* bottom-left */}
      <svg
        className="absolute bottom-0 left-0"
        width={size}
        height={size}
        style={{ filter }}
      >
        <path
          d={`M 0 0 L 0 ${size} L ${size} ${size}`}
          fill="none"
          stroke={stroke}
          strokeWidth="1.5"
        />
      </svg>
      {/* bottom-right */}
      <svg
        className="absolute bottom-0 right-0"
        width={size}
        height={size}
        style={{ filter }}
      >
        <path
          d={`M ${size} 0 L ${size} ${size} L 0 ${size}`}
          fill="none"
          stroke={stroke}
          strokeWidth="1.5"
        />
      </svg>
    </div>
  );
}
