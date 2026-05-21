"use client";

import { useEffect, useState } from "react";
import type { Memory } from "@/lib/memory-types";

interface ChatPreviewProps {
  memory: Memory | null;
  loading: boolean;
  onClose: () => void;
  onOpenInPanel: () => void;
}

type View = "preview" | "full";

export function ChatPreview({
  memory,
  loading,
  onClose,
  onOpenInPanel,
}: ChatPreviewProps) {
  const [view, setView] = useState<View>("preview");

  useEffect(() => {
    setView("preview");
  }, [memory?.id]);

  useEffect(() => {
    if (!memory) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [memory, onClose]);

  if (!memory && !loading) return null;

  return (
    <div
      className="pointer-events-auto absolute left-1/2 top-6 z-30 w-[min(560px,calc(100%-48px))] -translate-x-1/2"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="rounded-xl border border-amber-core/40 bg-charcoal-900/95 shadow-[0_0_60px_rgba(79,195,255,0.35)] backdrop-blur">
        <div className="flex items-center justify-between border-b border-charcoal-700 px-4 py-2.5">
          <div className="flex items-center gap-2 truncate">
            <span className="inline-block h-2 w-2 rounded-full bg-amber-core shadow-[0_0_10px_rgba(255,200,80,0.9)]" />
            <h3 className="truncate text-sm font-semibold text-amber-core glow-text">
              {loading ? "Loading memory…" : memory?.title}
            </h3>
          </div>
          <div className="flex items-center gap-1">
            {memory && (
              <button
                onClick={onOpenInPanel}
                className="rounded px-2 py-1 text-[10px] uppercase tracking-wide text-amber-glow/70 hover:bg-charcoal-700 hover:text-amber-glow"
                title="Open in side panel"
              >
                ▤ Panel
              </button>
            )}
            <button
              onClick={onClose}
              className="rounded px-2 py-1 text-xs text-amber-glow/60 hover:bg-charcoal-700 hover:text-amber-glow"
              title="Close (Esc)"
            >
              ✕
            </button>
          </div>
        </div>

        {loading || !memory ? (
          <div className="px-4 py-6 text-xs text-amber-glow/50">
            Loading chat…
          </div>
        ) : view === "preview" ? (
          <PreviewBody
            memory={memory}
            onExpand={() => setView("full")}
          />
        ) : (
          <FullBody memory={memory} onCollapse={() => setView("preview")} />
        )}
      </div>
    </div>
  );
}

function PreviewBody({
  memory,
  onExpand,
}: {
  memory: Memory;
  onExpand: () => void;
}) {
  const preview =
    memory.chat?.preview ??
    memory.body.split("\n").slice(0, 3).join("\n").slice(0, 240) ??
    "";
  const hasFull =
    Boolean(memory.chat?.turns?.length) || Boolean(memory.chat?.full);

  return (
    <div className="px-4 py-3">
      <div className="mb-2 flex items-center gap-2 text-[10px] uppercase tracking-wide text-amber-glow/40">
        <span>{memory.category}</span>
        <span>·</span>
        <span>preview</span>
      </div>
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-amber-glow/90">
        {preview || (
          <span className="italic text-amber-glow/40">
            No preview available for this memory.
          </span>
        )}
      </p>
      <div className="mt-3 flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-wide text-amber-glow/40">
          {hasFull ? "Tap to see the full chat" : "No full transcript stored"}
        </div>
        <button
          onClick={onExpand}
          disabled={!hasFull}
          className="rounded-full border border-amber-core/60 px-3 py-1 text-[11px] uppercase tracking-wide text-amber-core transition hover:bg-amber-core/15 disabled:cursor-not-allowed disabled:border-charcoal-700 disabled:text-amber-glow/30"
        >
          {hasFull ? "View full chat →" : "No chat"}
        </button>
      </div>
    </div>
  );
}

function FullBody({
  memory,
  onCollapse,
}: {
  memory: Memory;
  onCollapse: () => void;
}) {
  const turns = memory.chat?.turns ?? [];
  const fallback = memory.chat?.full ?? memory.body;

  return (
    <div className="max-h-[60vh] overflow-y-auto px-4 py-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-wide text-amber-glow/40">
          full transcript
        </div>
        <button
          onClick={onCollapse}
          className="text-[11px] text-amber-glow/60 hover:text-amber-glow"
        >
          ← preview
        </button>
      </div>

      {turns.length > 0 ? (
        <div className="space-y-2">
          {turns.map((turn, i) => (
            <ChatBubble key={i} role={turn.role} content={turn.content} />
          ))}
        </div>
      ) : (
        <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed text-amber-glow/90">
          {fallback}
        </pre>
      )}
    </div>
  );
}

function ChatBubble({
  role,
  content,
}: {
  role: "user" | "assistant" | "system";
  content: string;
}) {
  if (role === "system") {
    return (
      <div className="text-[10px] italic text-amber-glow/40">{content}</div>
    );
  }
  const isUser = role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-lg px-3 py-2 text-xs leading-relaxed ${
          isUser
            ? "border border-amber-core/40 bg-amber-core/10 text-amber-glow"
            : "border border-charcoal-700 bg-charcoal-800 text-amber-glow/90"
        }`}
      >
        <div className="mb-1 text-[9px] uppercase tracking-wide text-amber-glow/40">
          {role}
        </div>
        <div className="whitespace-pre-wrap">{content}</div>
      </div>
    </div>
  );
}
