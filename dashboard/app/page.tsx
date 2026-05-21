"use client";

import { useCallback, useEffect, useState } from "react";
import { Brain } from "@/components/Brain";
import { MemoryPanel } from "@/components/MemoryPanel";
import { HandTracker } from "@/components/HandTracker";
import { SearchBar } from "@/components/SearchBar";
import { NewMemoryModal } from "@/components/NewMemoryModal";
import { ChatPreview } from "@/components/ChatPreview";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { StatsPanel } from "@/components/StatsPanel";
import type {
  Memory,
  MemoryCategory,
  MemorySummary,
} from "@/lib/memory-types";
import {
  getMemory,
  isDemoMode,
  listMemories,
} from "@/lib/storage-client";

const POLL_INTERVAL_MS = 30_000;

export default function HomePage() {
  const [memories, setMemories] = useState<MemorySummary[]>([]);
  const [activeRegion, setActiveRegion] = useState<MemoryCategory | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Memory | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [gestureEnabled, setGestureEnabled] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [showStats, setShowStats] = useState(false);

  // Any "I want to see this memory" gesture funnels through here.
  const focusMemory = useCallback((id: string | null) => {
    setSelectedId(id);
    setPreviewOpen(id !== null);
  }, []);

  const loadMemories = useCallback(async () => {
    setRefreshing(true);
    try {
      const list = await listMemories();
      setMemories(list);
      setLastSyncAt(Date.now());
    } catch {
      // keep previous state on transient failures
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadMemories();
    const id = setInterval(() => void loadMemories(), POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [loadMemories]);

  // Dwell-fired selection from HandTracker
  useEffect(() => {
    const onSelect = (e: Event) => {
      const d = (e as CustomEvent<{ memoryId: string | null }>).detail;
      if (d?.memoryId) focusMemory(d.memoryId);
    };
    window.addEventListener("echo-select", onSelect as EventListener);
    return () =>
      window.removeEventListener("echo-select", onSelect as EventListener);
  }, [focusMemory]);

  // Keyboard navigation: ←/→ cycles memories (freshest first), Esc clears
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (showNewModal) return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      // Ignore when typing in inputs/textareas
      if (tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable) {
        return;
      }
      if (e.key === "Escape") {
        if (previewOpen) {
          setPreviewOpen(false);
        } else if (selectedId) {
          focusMemory(null);
        }
        return;
      }
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      if (memories.length === 0) return;
      const sorted = [...memories].sort((a, b) => b.freshness - a.freshness);
      const idx = sorted.findIndex((m) => m.id === selectedId);
      const dir = e.key === "ArrowRight" ? 1 : -1;
      const nextIdx =
        idx === -1
          ? dir === 1
            ? 0
            : sorted.length - 1
          : (idx + dir + sorted.length) % sorted.length;
      const next = sorted[nextIdx];
      if (next) focusMemory(next.id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [memories, selectedId, previewOpen, showNewModal, focusMemory]);

  // Single source of truth for the detail fetch — shared by ChatPreview + Panel.
  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      setDetailLoading(false);
      return;
    }
    let active = true;
    setDetailLoading(true);
    getMemory(selectedId)
      .then((m) => {
        if (!active) return;
        setDetail(m);
      })
      .catch(() => {
        if (!active) return;
        setDetail(null);
      })
      .finally(() => {
        if (active) setDetailLoading(false);
      });
    return () => {
      active = false;
    };
  }, [selectedId]);

  return (
    <main className="flex h-screen w-screen bg-charcoal-900 text-amber-glow">
      <div className="flex flex-1 flex-col">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-charcoal-700 px-6 py-3">
          <div>
            <h1 className="text-lg font-semibold text-amber-glow glow-text">
              Echo <span className="text-xs text-amber-glow/40">· Jarvis mode</span>
            </h1>
            <p className="text-xs text-amber-glow/60">
              Your memory, made visible · v0.1.1
              {isDemoMode && (
                <span className="ml-2 rounded-full border border-amber-core/40 px-2 py-0.5 text-[9px] uppercase tracking-wider text-amber-core/80">
                  demo · browser-local
                </span>
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <SearchBar onMatch={focusMemory} />
            <button
              onClick={() => setShowStats(true)}
              title="Who you are — synthesized profile"
              className="rounded-full border border-charcoal-600 px-3 py-1.5 text-xs uppercase tracking-wide text-amber-glow transition hover:bg-charcoal-700"
            >
              ◉ You
            </button>
            <button
              onClick={() => setShowNewModal(true)}
              className="rounded-full border border-amber-core/60 px-3 py-1.5 text-xs uppercase tracking-wide text-amber-core transition hover:bg-amber-core/15"
            >
              + New
            </button>
            <button
              onClick={() => void loadMemories()}
              disabled={refreshing}
              title={
                lastSyncAt
                  ? `Last sync ${new Date(lastSyncAt).toLocaleTimeString()}`
                  : "Sync memories"
              }
              className="rounded-full border border-charcoal-600 px-3 py-1.5 text-xs uppercase tracking-wide text-amber-glow transition hover:bg-charcoal-700 disabled:opacity-50"
            >
              {refreshing ? "Syncing…" : "↻ Refresh"}
            </button>
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
          </div>
        </header>

        <div className="relative flex-1">
          <ErrorBoundary>
            <Brain
              memories={memories}
              selectedId={selectedId}
              highlightedRegion={activeRegion}
              onSelectMemory={focusMemory}
              onRegionHover={setActiveRegion}
            />
          </ErrorBoundary>
          {gestureEnabled && <HandTracker onRegion={setActiveRegion} />}
          {previewOpen && selectedId && (
            <ChatPreview
              memory={detail}
              loading={detailLoading}
              onClose={() => setPreviewOpen(false)}
              onOpenInPanel={() => setPreviewOpen(false)}
            />
          )}
        </div>
      </div>

      <MemoryPanel
        memories={memories}
        filterRegion={activeRegion}
        selectedId={selectedId}
        detail={detail}
        onSelect={focusMemory}
        onDeleted={() => {
          focusMemory(null);
          void loadMemories();
        }}
      />

      <NewMemoryModal
        open={showNewModal}
        onClose={() => setShowNewModal(false)}
        onCreated={(id) => {
          void loadMemories();
          focusMemory(id);
        }}
      />

      <StatsPanel
        open={showStats}
        memories={memories}
        onClose={() => setShowStats(false)}
        onSelectMemory={focusMemory}
      />
    </main>
  );
}
