"use client";

import { useMemo, useState } from "react";
import type {
  MemoryCategory,
  MemorySummary,
  Memory,
} from "@/lib/memory-types";
import { deleteMemoryById } from "@/lib/storage-client";
import { useToast } from "./Toast";

interface MemoryPanelProps {
  memories: MemorySummary[];
  filterRegion: MemoryCategory | null;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  detail: Memory | null;
  onDeleted: () => void;
}

export function MemoryPanel({
  memories,
  filterRegion,
  selectedId,
  onSelect,
  detail,
  onDeleted,
}: MemoryPanelProps) {
  const [deleting, setDeleting] = useState(false);
  const { toast } = useToast();
  async function handleDelete(id: string) {
    if (!confirm(`Delete memory "${id}"?`)) return;
    setDeleting(true);
    try {
      const ok = await deleteMemoryById(id);
      if (ok) {
        toast(`Deleted "${id}"`, "success");
        onDeleted();
      } else {
        toast(`Couldn't delete "${id}"`, "error");
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : "Delete failed", "error");
    } finally {
      setDeleting(false);
    }
  }

  const [query, setQuery] = useState("");
  const titleById = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of memories) map.set(m.id, m.title);
    return map;
  }, [memories]);

  const filtered = filterRegion
    ? memories.filter((m) => m.category === filterRegion)
    : memories;
  const q = query.trim().toLowerCase();
  const searched = q
    ? filtered.filter(
        (m) =>
          m.title.toLowerCase().includes(q) ||
          m.id.toLowerCase().includes(q) ||
          m.category.toLowerCase().includes(q) ||
          m.tags.some((t) => t.toLowerCase().includes(q)),
      )
    : filtered;
  const sorted = [...searched].sort((a, b) => b.freshness - a.freshness);

  return (
    <aside className="flex h-full w-96 flex-col border-l border-charcoal-700 bg-charcoal-800/60">
      <header className="border-b border-charcoal-700 px-4 py-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-amber-glow">
          {filterRegion ? `Region · ${filterRegion}` : "All memories"}
        </h2>
        <p className="mt-1 text-xs text-amber-glow/60">
          {sorted.length} {sorted.length === 1 ? "memory" : "memories"}
        </p>
        <div className="mt-2 flex items-center gap-2">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter title, id, tag…"
            className="w-full rounded border border-charcoal-700 bg-charcoal-900 px-2 py-1 text-xs text-amber-glow placeholder-amber-glow/30 focus:border-amber-core focus:outline-none"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="text-xs text-amber-glow/50 hover:text-amber-glow"
              title="Clear"
            >
              ✕
            </button>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        {sorted.length === 0 && (
          <div className="px-4 py-6 text-sm text-amber-glow/50">
            {memories.length === 0
              ? "No memories yet — save one through Sage to populate the brain."
              : "No memories in this region."}
          </div>
        )}
        {sorted.map((m) => (
          <button
            key={m.id}
            data-memory-id={m.id}
            onClick={() => onSelect(selectedId === m.id ? null : m.id)}
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
              {m.id} · {m.category}
            </div>
          </button>
        ))}
      </div>

      {detail && (
        <div className="max-h-[55%] overflow-y-auto border-t border-charcoal-700 bg-charcoal-900 px-4 py-3">
          <div className="mb-2 flex items-start justify-between gap-2">
            <h3 className="text-sm font-semibold text-amber-core glow-text">
              {detail.title}
            </h3>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleDelete(detail.id)}
                disabled={deleting}
                title="Delete memory"
                className="text-xs text-red-300/70 hover:text-red-300 disabled:opacity-50"
              >
                {deleting ? "…" : "🗑"}
              </button>
              <button
                onClick={() => onSelect(null)}
                className="text-xs text-amber-glow/60 hover:text-amber-glow"
              >
                ✕
              </button>
            </div>
          </div>

          <div className="mb-3 grid grid-cols-2 gap-2 text-[10px] uppercase tracking-wide text-amber-glow/50">
            <div>
              <div className="text-amber-glow/40">Category</div>
              <div className="mt-0.5 text-amber-glow/80">{detail.category}</div>
            </div>
            <div>
              <div className="text-amber-glow/40">Updated</div>
              <div className="mt-0.5 text-amber-glow/80">
                {new Date(detail.provenance.updatedAt).toLocaleString()}
              </div>
            </div>
            {detail.provenance.source && (
              <div className="col-span-2">
                <div className="text-amber-glow/40">Source</div>
                <div className="mt-0.5 normal-case text-amber-glow/80">
                  {detail.provenance.source}
                </div>
              </div>
            )}
            {detail.tags.length > 0 && (
              <div className="col-span-2">
                <div className="text-amber-glow/40">Tags</div>
                <div className="mt-0.5 flex flex-wrap gap-1">
                  {detail.tags.map((t) => (
                    <span
                      key={t}
                      className="rounded-full bg-charcoal-700 px-2 py-0.5 normal-case text-amber-glow/80"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="amber-line mb-3" />

          <pre className="whitespace-pre-wrap font-sans text-xs text-amber-glow/90">
            {detail.body}
          </pre>

          {detail.relatedIds.length > 0 && (
            <div className="mt-4 border-t border-charcoal-700 pt-3">
              <div className="mb-1 text-[10px] uppercase tracking-wide text-amber-glow/40">
                Related
              </div>
              <div className="flex flex-col gap-1">
                {detail.relatedIds.map((rid) => {
                  const title = titleById.get(rid);
                  return (
                    <button
                      key={rid}
                      onClick={() => onSelect(rid)}
                      className={`rounded px-2 py-1 text-left text-xs hover:bg-charcoal-700 ${
                        title
                          ? "text-amber-core"
                          : "text-amber-glow/40 italic"
                      }`}
                      title={rid}
                    >
                      → {title ?? `${rid} (missing)`}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
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
