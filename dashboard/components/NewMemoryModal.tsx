"use client";

import { useEffect, useState } from "react";
import {
  MEMORY_CATEGORIES,
  type MemoryCategory,
} from "@/lib/memory-types";
import { createMemory } from "@/lib/storage-client";
import { useToast } from "./Toast";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (id: string) => void;
}

const DEFAULT_CATEGORY: MemoryCategory = "project";

export function NewMemoryModal({ open, onClose, onCreated }: Props) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState<MemoryCategory>(DEFAULT_CATEGORY);
  const [tagsRaw, setTagsRaw] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (!open) {
      setTitle("");
      setBody("");
      setCategory(DEFAULT_CATEGORY);
      setTagsRaw("");
      setError(null);
      setSubmitting(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        void submit();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // submit closes over current state — re-bind each open
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, onClose, title, body, category, tagsRaw]);

  if (!open) return null;

  async function submit() {
    if (!title.trim()) {
      setError("Title required");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const m = await createMemory({
        title: title.trim(),
        body,
        category,
        tags: tagsRaw
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
      });
      toast(`Saved "${m.title}"`, "success");
      onCreated(m.id);
      onClose();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Save failed";
      setError(msg);
      toast(msg, "error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-lg border border-amber-core/40 bg-charcoal-900 p-5 shadow-[0_0_60px_rgba(79,195,255,0.25)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-amber-core glow-text">
            New memory
          </h3>
          <button
            onClick={onClose}
            className="text-xs text-amber-glow/60 hover:text-amber-glow"
          >
            ✕
          </button>
        </div>

        <div className="space-y-3">
          <label className="block">
            <div className="text-[10px] uppercase tracking-wide text-amber-glow/50">
              Title
            </div>
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 w-full rounded border border-charcoal-700 bg-charcoal-800 px-2 py-1.5 text-sm text-amber-glow focus:border-amber-core focus:outline-none"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <div className="text-[10px] uppercase tracking-wide text-amber-glow/50">
                Category
              </div>
              <select
                value={category}
                onChange={(e) =>
                  setCategory(e.target.value as MemoryCategory)
                }
                className="mt-1 w-full rounded border border-charcoal-700 bg-charcoal-800 px-2 py-1.5 text-sm text-amber-glow focus:border-amber-core focus:outline-none"
              >
                {MEMORY_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <div className="text-[10px] uppercase tracking-wide text-amber-glow/50">
                Tags (comma-sep)
              </div>
              <input
                value={tagsRaw}
                onChange={(e) => setTagsRaw(e.target.value)}
                placeholder="e.g. trading, sage"
                className="mt-1 w-full rounded border border-charcoal-700 bg-charcoal-800 px-2 py-1.5 text-sm text-amber-glow focus:border-amber-core focus:outline-none"
              />
            </label>
          </div>

          <label className="block">
            <div className="text-[10px] uppercase tracking-wide text-amber-glow/50">
              Body
            </div>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={6}
              className="mt-1 w-full resize-y rounded border border-charcoal-700 bg-charcoal-800 px-2 py-1.5 text-sm text-amber-glow focus:border-amber-core focus:outline-none"
            />
          </label>

          {error && (
            <div className="rounded bg-red-900/40 px-3 py-1.5 text-xs text-red-200">
              {error}
            </div>
          )}

          <div className="flex items-center justify-between gap-2 pt-2">
            <div className="text-[10px] uppercase tracking-wide text-amber-glow/30">
              Ctrl+Enter to save · Esc to cancel
            </div>
            <div className="flex gap-2">
            <button
              onClick={onClose}
              className="rounded-full border border-charcoal-600 px-4 py-1.5 text-xs uppercase tracking-wide text-amber-glow hover:bg-charcoal-700"
            >
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={submitting || !title.trim()}
              className="rounded-full border border-amber-core bg-amber-core px-4 py-1.5 text-xs uppercase tracking-wide text-charcoal-900 disabled:opacity-50"
            >
              {submitting ? "Saving…" : "Save memory"}
            </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
