"use client";

import { useEffect, useMemo } from "react";
import {
  BRAIN_REGIONS,
  type MemoryCategory,
  type MemorySummary,
} from "@/lib/memory-types";

interface Props {
  memories: MemorySummary[];
  open: boolean;
  onClose: () => void;
  onSelectMemory: (id: string) => void;
}

export function StatsPanel({ memories, open, onClose, onSelectMemory }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const stats = useMemo(() => {
    const byCategory: Record<string, number> = {};
    const tagCounts: Record<string, number> = {};
    let oldest: MemorySummary | null = null;
    let newest: MemorySummary | null = null;
    for (const m of memories) {
      byCategory[m.category] = (byCategory[m.category] ?? 0) + 1;
      for (const t of m.tags) tagCounts[t] = (tagCounts[t] ?? 0) + 1;
      const ts = new Date(m.updatedAt).getTime();
      if (!oldest || ts < new Date(oldest.updatedAt).getTime()) oldest = m;
      if (!newest || ts > new Date(newest.updatedAt).getTime()) newest = m;
    }
    const topTags = Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);
    const topCategory =
      Object.entries(byCategory).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    const avgFreshness =
      memories.length === 0
        ? 0
        : memories.reduce((s, m) => s + m.freshness, 0) / memories.length;
    return {
      byCategory,
      topTags,
      topCategory,
      oldest,
      newest,
      avgFreshness,
    };
  }, [memories]);

  if (!open) return null;

  const maxCount = Math.max(1, ...Object.values(stats.byCategory));

  return (
    <div
      className="fixed inset-0 z-[80] flex items-start justify-center bg-black/60 pt-20"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-lg border border-amber-core/40 bg-charcoal-900/95 p-5 shadow-[0_0_60px_rgba(79,195,255,0.3)] backdrop-blur"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-core glow-text">
              Who you are
            </h3>
            <p className="mt-0.5 text-[10px] uppercase tracking-wider text-amber-glow/40">
              synthesized from {memories.length}{" "}
              {memories.length === 1 ? "memory" : "memories"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-xs text-amber-glow/60 hover:text-amber-glow"
            title="Close (Esc)"
          >
            ✕
          </button>
        </div>

        {memories.length === 0 ? (
          <div className="rounded border border-charcoal-700 bg-charcoal-800/60 px-3 py-4 text-center text-xs text-amber-glow/50">
            Nothing to synthesize yet — save a memory first.
          </div>
        ) : (
          <div className="space-y-4">
            {/* Snapshot line */}
            <p className="text-xs leading-relaxed text-amber-glow/85">
              You lean toward{" "}
              <span className="text-amber-core">
                {BRAIN_REGIONS[stats.topCategory as MemoryCategory]?.label ??
                  stats.topCategory}
              </span>
              {stats.topTags[0] && (
                <>
                  , most-tagged with{" "}
                  <span className="text-amber-core">
                    #{stats.topTags[0][0]}
                  </span>
                </>
              )}
              . Brain freshness:{" "}
              <span className="text-amber-core">
                {(stats.avgFreshness * 100).toFixed(0)}%
              </span>
              .
            </p>

            {/* Category bars */}
            <div>
              <div className="mb-1.5 text-[10px] uppercase tracking-wider text-amber-glow/40">
                regions
              </div>
              <div className="space-y-1.5">
                {(Object.entries(BRAIN_REGIONS) as Array<
                  [MemoryCategory, (typeof BRAIN_REGIONS)[MemoryCategory]]
                >).map(([cat, region]) => {
                  const count = stats.byCategory[cat] ?? 0;
                  if (count === 0) return null;
                  const pct = (count / maxCount) * 100;
                  const color = `hsl(${region.hue} 80% 65%)`;
                  return (
                    <div
                      key={cat}
                      className="flex items-center gap-2 text-[11px]"
                    >
                      <div className="w-16 text-amber-glow/70">
                        {region.label}
                      </div>
                      <div className="relative h-2 flex-1 overflow-hidden rounded bg-charcoal-800">
                        <div
                          className="h-full rounded transition-all"
                          style={{
                            width: `${pct}%`,
                            background: color,
                            boxShadow: `0 0 8px ${color}66`,
                          }}
                        />
                      </div>
                      <div className="w-6 text-right text-amber-glow/50">
                        {count}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Top tags */}
            {stats.topTags.length > 0 && (
              <div>
                <div className="mb-1.5 text-[10px] uppercase tracking-wider text-amber-glow/40">
                  top tags
                </div>
                <div className="flex flex-wrap gap-1">
                  {stats.topTags.map(([tag, count]) => (
                    <span
                      key={tag}
                      className="rounded-full border border-amber-core/30 bg-charcoal-800/60 px-2 py-0.5 text-[10px] text-amber-glow/80"
                    >
                      #{tag}
                      <span className="ml-1 text-amber-core/70">{count}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Oldest / newest */}
            <div className="grid grid-cols-2 gap-2 border-t border-charcoal-700 pt-3 text-[11px]">
              {stats.oldest && (
                <TimeAnchor
                  label="oldest"
                  memory={stats.oldest}
                  onClick={() => {
                    onSelectMemory(stats.oldest!.id);
                    onClose();
                  }}
                />
              )}
              {stats.newest && (
                <TimeAnchor
                  label="newest"
                  memory={stats.newest}
                  onClick={() => {
                    onSelectMemory(stats.newest!.id);
                    onClose();
                  }}
                />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TimeAnchor({
  label,
  memory,
  onClick,
}: {
  label: string;
  memory: MemorySummary;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="rounded border border-charcoal-700 bg-charcoal-800/60 p-2 text-left transition hover:border-amber-core/40 hover:bg-charcoal-700/60"
    >
      <div className="text-[9px] uppercase tracking-wider text-amber-glow/40">
        {label}
      </div>
      <div className="mt-0.5 truncate text-amber-glow">{memory.title}</div>
      <div className="mt-0.5 text-[10px] text-amber-glow/50">
        {new Date(memory.updatedAt).toLocaleDateString()}
      </div>
    </button>
  );
}
