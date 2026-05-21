"use client";

import { useEffect, useRef, useState } from "react";

interface ShortcutRow {
  keys: string[];
  label: string;
}

const SHORTCUTS: ShortcutRow[] = [
  { keys: ["drag"], label: "rotate brain" },
  { keys: ["scroll"], label: "zoom" },
  { keys: ["click"], label: "focus memory" },
  { keys: ["←", "→"], label: "cycle memories" },
  { keys: ["esc"], label: "close / clear" },
  { keys: ["⌃", "↵"], label: "save (new memory)" },
  { keys: ["🎙"], label: "speak or type to search" },
  { keys: ['"remember X"'], label: "voice / text to save" },
  { keys: ["👆"], label: "hover 0.75s to select (gesture)" },
  { keys: ["🤏"], label: "pinch to select (gesture)" },
];

export function Legend() {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  // Close on outside click + Esc
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div
      ref={wrapRef}
      className="absolute left-1/2 top-4 z-30 -translate-x-1/2"
    >
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full border border-amber-core/40 bg-charcoal-800/85 px-3 py-1.5 text-[10px] uppercase tracking-[0.18em] text-amber-glow/85 shadow-[0_0_16px_rgba(79,195,255,0.18)] backdrop-blur transition hover:bg-charcoal-700/85"
        title={open ? "Hide shortcuts" : "Show shortcuts"}
        aria-expanded={open}
      >
        <span className="text-amber-core/80">◐</span>
        <span>drag</span>
        <span className="text-amber-glow/30">·</span>
        <Kbd>←</Kbd>
        <Kbd>→</Kbd>
        <span className="text-amber-glow/30">·</span>
        <span className="text-amber-core/80">{open ? "▴" : "▾"}</span>
      </button>

      {open && (
        <div className="absolute left-1/2 top-full mt-2 w-72 -translate-x-1/2 rounded-lg border border-amber-core/30 bg-charcoal-900/95 p-3 shadow-[0_0_40px_rgba(79,195,255,0.25)] backdrop-blur">
          <div className="mb-2 text-[10px] uppercase tracking-[0.18em] text-amber-core/70">
            Echo · controls
          </div>
          <ul className="space-y-1.5">
            {SHORTCUTS.map((s) => (
              <li
                key={s.label}
                className="flex items-center justify-between gap-3 text-[11px] text-amber-glow/85"
              >
                <span className="flex items-center gap-1">
                  {s.keys.map((k, i) => (
                    <Kbd key={i}>{k}</Kbd>
                  ))}
                </span>
                <span className="text-right text-amber-glow/60">{s.label}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex min-w-[1.4rem] items-center justify-center rounded border border-amber-core/40 bg-charcoal-900/70 px-1.5 py-0.5 font-mono text-[10px] text-amber-glow/90 shadow-[0_0_6px_rgba(79,195,255,0.15)_inset]">
      {children}
    </span>
  );
}
