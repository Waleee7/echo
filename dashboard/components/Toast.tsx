"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

export type ToastKind = "info" | "success" | "error";
interface Toast {
  id: number;
  kind: ToastKind;
  msg: string;
}

interface Ctx {
  toast: (msg: string, kind?: ToastKind) => void;
}

const ToastCtx = createContext<Ctx | null>(null);

export function useToast(): Ctx {
  const ctx = useContext(ToastCtx);
  if (!ctx) return { toast: () => {} };
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);

  const toast = useCallback((msg: string, kind: ToastKind = "info") => {
    const id = Date.now() + Math.random();
    setItems((prev) => [...prev, { id, msg, kind }]);
    setTimeout(() => {
      setItems((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  return (
    <ToastCtx.Provider value={{ toast }}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
        {items.map((t) => (
          <ToastCard key={t.id} toast={t} />
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

function ToastCard({ toast }: { toast: Toast }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setShow(true), 10);
    return () => clearTimeout(t);
  }, []);
  const colors =
    toast.kind === "error"
      ? "border-red-400/50 bg-red-900/80 text-red-100"
      : toast.kind === "success"
        ? "border-amber-core/60 bg-charcoal-800/95 text-amber-glow"
        : "border-charcoal-600 bg-charcoal-800/95 text-amber-glow/90";
  return (
    <div
      className={`pointer-events-auto max-w-xs rounded-lg border px-3 py-2 text-xs shadow-[0_0_30px_rgba(79,195,255,0.25)] backdrop-blur transition ${colors}`}
      style={{
        opacity: show ? 1 : 0,
        transform: show ? "translateY(0)" : "translateY(8px)",
        transition: "opacity 200ms, transform 200ms",
      }}
    >
      {toast.msg}
    </div>
  );
}
