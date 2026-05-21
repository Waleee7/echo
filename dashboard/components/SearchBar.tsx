"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { MemorySummary } from "@/lib/memory-types";
import { createMemory, searchMemories } from "@/lib/storage-client";
import { useToast } from "./Toast";

const SAVE_PREFIXES = [
  /^\s*remember(?:\s+that)?[\s,:-]+(.+)$/i,
  /^\s*save(?:\s+this)?[\s,:-]+(.+)$/i,
  /^\s*note(?:\s+that)?[\s,:-]+(.+)$/i,
  /^\s*store[\s,:-]+(.+)$/i,
];

function detectSave(input: string): string | null {
  for (const re of SAVE_PREFIXES) {
    const m = input.match(re);
    if (m && m[1]) return m[1].trim();
  }
  return null;
}

function deriveTitle(body: string): string {
  const firstSentence = body.split(/[.!?\n]/)[0]?.trim() ?? body;
  return firstSentence.slice(0, 60) || "Untitled";
}

interface SearchBarProps {
  onMatch: (id: string) => void;
}

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: { transcript: string };
}
interface SpeechRecognitionEventLike extends Event {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}
interface SpeechRecognitionErrorLike extends Event {
  error: string;
  message?: string;
}
interface SpeechRecognitionLike extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: SpeechRecognitionErrorLike) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
  onspeechstart: (() => void) | null;
  onspeechend: (() => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  }
}

type MicState = "off" | "listening" | "hearing" | "denied" | "unsupported";

const ERROR_HINTS: Record<string, string> = {
  "not-allowed":
    "Mic blocked. Click the lock icon → Site settings → allow Microphone.",
  "service-not-allowed": "Mic service blocked by OS. Check Windows mic privacy.",
  "no-speech": "Didn't catch that — say it again, closer to the mic.",
  "audio-capture": "No mic found.",
  network:
    "Voice service offline — type the query instead. (Chrome routes speech through Google's cloud.)",
  aborted: "",
};
// Errors that should NOT auto-restart the recognizer
const FATAL_ERRORS = new Set([
  "not-allowed",
  "service-not-allowed",
  "audio-capture",
  "network",
]);

export function SearchBar({ onMatch }: SearchBarProps) {
  const [query, setQuery] = useState("");
  const [interim, setInterim] = useState("");
  const [micState, setMicState] = useState<MicState>("off");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [candidates, setCandidates] = useState<MemorySummary[]>([]);
  const [searching, setSearching] = useState(false);
  const { toast } = useToast();
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const wantsListeningRef = useRef(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const runSearch = useCallback(
    async (raw: string) => {
      const q = raw.trim();
      if (!q) return;

      // Voice-to-save: "remember X" / "save X" / "note X" → create memory
      const saveBody = detectSave(q);
      if (saveBody) {
        setSearching(true);
        setErrorMsg("");
        try {
          const m = await createMemory({
            title: deriveTitle(saveBody),
            body: saveBody,
            category: "user",
            tags: [],
          });
          toast(`💾 Saved "${m.title}"`, "success");
          setQuery("");
          setCandidates([]);
          onMatch(m.id);
        } catch (e) {
          setErrorMsg(e instanceof Error ? e.message : "Save failed");
        } finally {
          setSearching(false);
        }
        return;
      }

      setSearching(true);
      setErrorMsg("");
      try {
        const results = await searchMemories(q, 5);
        if (results.length > 0 && results[0]) {
          setCandidates(results);
          onMatch(results[0].id);
        } else {
          setCandidates([]);
          setErrorMsg(`No memory matches "${q}"`);
        }
      } catch {
        setErrorMsg("Search failed");
      } finally {
        setSearching(false);
      }
    },
    [onMatch, toast],
  );

  // Initialize SpeechRecognition once
  useEffect(() => {
    const Recog =
      typeof window !== "undefined"
        ? (window.SpeechRecognition ?? window.webkitSpeechRecognition)
        : undefined;
    if (!Recog) {
      setMicState("unsupported");
      return;
    }
    const r = new Recog();
    r.continuous = true;
    r.interimResults = true;
    r.maxAlternatives = 1;
    r.lang = "en-US";

    r.onstart = () => setMicState("listening");
    r.onspeechstart = () => setMicState("hearing");
    r.onspeechend = () =>
      setMicState((s) => (s === "hearing" ? "listening" : s));

    r.onresult = (e: SpeechRecognitionEventLike) => {
      let interimChunk = "";
      let finalChunk = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const result = e.results[i];
        if (!result) continue;
        const text = result[0].transcript;
        if (result.isFinal) finalChunk += text;
        else interimChunk += text;
      }
      if (finalChunk) {
        const next = finalChunk.trim();
        setQuery(next);
        setInterim("");
        wantsListeningRef.current = false;
        try {
          r.stop();
        } catch {}
        void runSearch(next);
      } else {
        setInterim(interimChunk);
      }
    };

    r.onerror = (e: SpeechRecognitionErrorLike) => {
      const kind = e.error || "error";
      if (kind === "aborted") return;
      if (FATAL_ERRORS.has(kind)) {
        wantsListeningRef.current = false;
        setMicState(kind === "not-allowed" ? "denied" : "off");
        setErrorMsg(ERROR_HINTS[kind] ?? kind);
        return;
      }
      // no-speech is recoverable — onend will restart if still wanted
      if (kind !== "no-speech") {
        setErrorMsg(ERROR_HINTS[kind] ?? kind);
      }
    };

    r.onend = () => {
      if (wantsListeningRef.current) {
        try {
          r.start();
          return;
        } catch {}
      }
      setMicState((s) =>
        s === "listening" || s === "hearing" ? "off" : s,
      );
    };

    recognitionRef.current = r;
    return () => {
      wantsListeningRef.current = false;
      try {
        r.abort();
      } catch {}
    };
  }, [runSearch]);

  function startMic() {
    const r = recognitionRef.current;
    if (!r) return;
    setErrorMsg("");
    setInterim("");
    setCandidates([]);
    wantsListeningRef.current = true;
    try {
      r.start();
    } catch {
      try {
        r.abort();
        setTimeout(() => {
          try {
            r.start();
          } catch {}
        }, 80);
      } catch {}
    }
  }

  function stopMic() {
    wantsListeningRef.current = false;
    try {
      recognitionRef.current?.stop();
    } catch {}
    setMicState("off");
  }

  function toggleMic() {
    if (micState === "listening" || micState === "hearing") {
      const pending = interim.trim() || query.trim();
      stopMic();
      if (pending) void runSearch(pending);
    } else if (micState === "denied" || micState === "unsupported") {
      // Focus the text input — voice unavailable, fall back to typing
      inputRef.current?.focus();
    } else {
      startMic();
    }
  }

  function onKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      void runSearch(query);
    } else if (e.key === "Escape") {
      setQuery("");
      setInterim("");
      setCandidates([]);
      setErrorMsg("");
    }
  }

  const isHot = micState === "listening" || micState === "hearing";
  const micTitle =
    micState === "unsupported"
      ? "Voice not supported in this browser — type instead"
      : micState === "denied"
        ? "Mic blocked"
        : isHot
          ? "Click to stop listening"
          : "Click to speak";
  const micIcon =
    micState === "unsupported" || micState === "denied" ? "🎙️🚫" : "🎙";

  return (
    <div className="flex flex-col items-end gap-1">
      <div
        className={`flex items-center gap-1 rounded-full border bg-charcoal-800/80 px-1 py-1 transition ${
          isHot
            ? "border-amber-core shadow-[0_0_18px_rgba(255,200,80,0.35)]"
            : "border-charcoal-600"
        }`}
      >
        <input
          ref={inputRef}
          value={isHot && interim ? interim : query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (errorMsg) setErrorMsg("");
          }}
          onKeyDown={onKey}
          placeholder="Search · or 'remember X' to save…"
          readOnly={isHot}
          className="w-48 bg-transparent px-3 py-1 text-xs text-amber-glow placeholder-amber-glow/40 focus:outline-none"
          aria-label="Search memories"
        />
        {query && !isHot && (
          <button
            onClick={() => {
              setQuery("");
              setCandidates([]);
              setErrorMsg("");
              inputRef.current?.focus();
            }}
            className="rounded px-2 text-xs text-amber-glow/50 hover:text-amber-glow"
            title="Clear"
          >
            ✕
          </button>
        )}
        <button
          onClick={() => void runSearch(query)}
          disabled={!query.trim() || searching || isHot}
          className="rounded-full px-2 py-1 text-[11px] text-amber-glow/70 transition hover:bg-charcoal-700 hover:text-amber-glow disabled:opacity-30"
          title="Search (Enter)"
        >
          {searching ? "…" : "↩"}
        </button>
        <button
          onClick={toggleMic}
          disabled={micState === "unsupported"}
          title={micTitle}
          className={`flex h-7 w-7 items-center justify-center rounded-full text-xs transition ${
            isHot
              ? "bg-amber-core text-charcoal-900 pulse-ring"
              : micState === "denied" || micState === "unsupported"
                ? "text-amber-glow/30"
                : "text-amber-glow hover:bg-charcoal-700"
          }`}
        >
          <span className={micState === "hearing" ? "animate-pulse" : ""}>
            {micIcon}
          </span>
        </button>
      </div>

      {isHot && (
        <div className="text-[10px] uppercase tracking-wide text-amber-core/80">
          {micState === "hearing" ? "Hearing you…" : "Listening…"}
        </div>
      )}

      {errorMsg && !isHot && (
        <div className="max-w-xs rounded bg-red-900/40 px-3 py-1 text-[11px] text-red-200">
          {errorMsg}
        </div>
      )}

      {candidates.length > 1 && !isHot && (
        <div className="flex flex-wrap items-center gap-1">
          {candidates.slice(1).map((c) => (
            <button
              key={c.id}
              onClick={() => onMatch(c.id)}
              className="rounded bg-charcoal-800/80 px-2 py-0.5 text-[10px] text-amber-glow/70 transition hover:bg-charcoal-700 hover:text-amber-glow"
              title={c.id}
            >
              {c.title}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
