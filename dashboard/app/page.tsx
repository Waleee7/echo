"use client";

import { useEffect, useState } from "react";
import { Brain } from "@/components/Brain";
import { MemoryPanel } from "@/components/MemoryPanel";
import { HandTracker } from "@/components/HandTracker";
import type { MemoryCategory, MemorySummary } from "@/lib/memory-types";

export default function HomePage() {
  const [memories, setMemories] = useState<MemorySummary[]>([]);
  const [activeRegion, setActiveRegion] = useState<MemoryCategory | null>(null);
  const [gestureEnabled, setGestureEnabled] = useState(false);

  useEffect(() => {
    fetch("/api/memories")
      .then((r) => r.json())
      .then((data: { memories: MemorySummary[] }) => setMemories(data.memories))
      .catch(() => setMemories([]));
  }, []);

  return (
    <main className="flex h-screen w-screen bg-charcoal-900 text-amber-glow">
      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-charcoal-700 px-6 py-3">
          <div>
            <h1 className="text-lg font-semibold text-amber-glow glow-text">
              Echo
            </h1>
            <p className="text-xs text-amber-glow/60">
              Your memory, made visible · v0.1.0
            </p>
          </div>
          <button
            onClick={() => setGestureEnabled((v) => !v)}
            className={`rounded-full border px-4 py-1.5 text-xs uppercase tracking-wide transition ${
              gestureEnabled
                ? "border-amber-core bg-amber-core text-charcoal-900"
                : "border-charcoal-600 text-amber-glow hover:bg-charcoal-700"
            }`}
          >
            {gestureEnabled ? "Gesture: On" : "Enable gesture"}
          </button>
        </header>

        <div className="relative flex-1">
          <Brain memories={memories} onRegionHover={setActiveRegion} />
          {gestureEnabled && (
            <HandTracker onRegion={setActiveRegion} />
          )}
        </div>
      </div>

      <MemoryPanel memories={memories} filterRegion={activeRegion} />
    </main>
  );
}
