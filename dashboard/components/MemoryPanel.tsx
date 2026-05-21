"use client";

import { useEffect, useState } from "react";
import type { MemoryCategory, MemorySummary, Memory } from "@/lib/memory-types";

interface MemoryPanelProps {
  memories: MemorySummary[];
  filterRegion: MemoryCategory | null;
}

export function MemoryPanel({ memories, filterRegion }: MemoryPanelProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Memory | null>(null);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    let active = true;
    fetch(`/api/memories/${encodeURIComponent(selectedId)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((data: { memory: Memory }) => {
        if (active) setDetail(data.memory);
      })
      .catch(() => {
        if (active) setDetail(null);
      });
    return () => {
      active = false;
    };
  }, [selectedId]);

  const filtered = filterRegion
    ? memories.filter((m) => m.category === filterRegion)
    : memories;

  const sorted = [...filtered].sort((a, b) => b.freshness - a.freshness);

  return (
    <aside className="flex h-full w-80 flex-col border-l border-charcoal-700 bg-charcoal-800/60">
      <header className="border-b border-charcoal-700 px-4 py-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-amber-glow">
          {filterRegion ? `Region · ${filterRegion}` : "All memories"}
        </h2>
        <p className="mt-1 text-xs text-amber-glow/60">
          {sorted.length} {sorted.length === 1 ? "memory" : "memories"}
        </p>
      </header>

      <div className="flex-1 overflow-y-auto">
        {sorted.length === 0 && (
          <div className="px-4 py-6 text-sm text-amber-glow/50">
            No memories yet — save one through Sage to populate the brain.
          </div>
        )}

        {sorted.map((m) => (
          <button
            key={m.id}
            onClick={() =>
              setSelectedId(selectedId === m.id ? null : m.id)
            }
            className={`block w-full border-b border-charcoal-700/60 px-4 py-3 text-left transition ${
              selectedId === m.id
                ? "bg-amber-core/15"
                : "hover:bg-charcoal-700/40"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-sm text-amber-glow">
                {m.title}
              </span>
              <FreshnessDot freshness={m.freshness} />
            </div>
            <div className="mt-0.5 text-xs text-amber-glow/50">
              {m.id}
            </div>
          </button>
        ))}
      </div>

      {detail && (
        <div className="max-h-1/2 overflow-y-auto border-t border-charcoal-700 bg-charcoal-900 px-4 py-3">
          <h3 className="mb-1 text-sm font-semibold text-amber-core glow-text">
            {detail.title}
          </h3>
          <div className="mb-2 text-xs text-amber-glow/50">
            {detail.category} · updated {new Date(detail.provenance.updatedAt).toLocaleDateString()}
          </div>
          <pre className="whitespace-pre-wrap text-xs text-amber-glow/80">
            {detail.body}
          </pre>
        </div>
      )}
    </aside>
  );
}

function FreshnessDot({ freshness }: { freshness: number }) {
  const opacity = 0.3 + freshness * 0.7;
  return (
    <span
      className="inline-block h-2 w-2 rounded-full bg-amber-core"
      style={{ opacity }}
      title={`Freshness ${(freshness * 100).toFixed(0)}%`}
    />
  );
}
