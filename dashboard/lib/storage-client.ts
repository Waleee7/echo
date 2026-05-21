"use client";

import {
  computeFreshness,
  type Memory,
  type MemoryCategory,
  type MemorySummary,
} from "./memory-types";

const DEMO =
  typeof process !== "undefined" &&
  process.env.NEXT_PUBLIC_DEMO_MODE === "true";

const LS_KEY = "echo:memories:v1";
const LS_SEEDED = "echo:seeded:v1";

function summarize(m: Memory): MemorySummary {
  return {
    id: m.id,
    title: m.title,
    category: m.category,
    tags: m.tags,
    updatedAt: m.provenance.updatedAt,
    freshness: computeFreshness(m.provenance.updatedAt),
    relatedIds: m.relatedIds,
    hasChat: Boolean(m.chat?.preview),
  };
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

const STOPWORDS = new Set([
  "the","a","an","and","or","but","of","in","on","at","to","for","is","was",
  "be","this","that","with","from","by","it","as","i","you","my","your",
]);

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 2 && !STOPWORDS.has(t)),
  );
}

/** Pick top-N similar memories by Jaccard on (tags + title + body tokens). */
function findRelated(
  candidate: { title: string; body: string; tags: string[] },
  pool: Pick<Memory, "id" | "title" | "body" | "tags">[],
  topN = 3,
): string[] {
  const a = tokenize(
    `${candidate.title} ${candidate.body} ${candidate.tags.join(" ")}`,
  );
  if (a.size === 0) return [];
  const scored = pool
    .map((m) => {
      const b = tokenize(`${m.title} ${m.body} ${m.tags.join(" ")}`);
      if (b.size === 0) return { id: m.id, score: 0 };
      let inter = 0;
      for (const t of a) if (b.has(t)) inter++;
      const union = a.size + b.size - inter;
      return { id: m.id, score: union ? inter / union : 0 };
    })
    .filter((r) => r.score >= 0.08)
    .sort((a, b) => b.score - a.score)
    .slice(0, topN);
  return scored.map((r) => r.id);
}

const WELCOME: Memory = {
  id: "welcome",
  title: "Welcome to your Echo",
  body:
    "This brain is yours. Every memory you create lives in this browser only — nothing leaves your device.\n\nClick + New to add a memory. Drag the brain to rotate. Hit ? for shortcuts.",
  category: "user",
  tags: ["intro"],
  provenance: {
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    source: "demo seed",
  },
  relatedIds: [],
  chat: {
    preview:
      "Echo started as a personal memory layer for an AI assistant named Sage. This demo lets you try the same brain interface with your own memories — stored locally in your browser.",
    turns: [
      {
        role: "assistant",
        content:
          "Hey — this is your Echo. Drop a memory in and it'll show up as a glowing dot on the brain.",
      },
      {
        role: "user",
        content: "Does it sync anywhere?",
      },
      {
        role: "assistant",
        content:
          "Nope, browser-only in demo mode. Clone the repo to run the full MCP server with file-backed storage on your own machine.",
      },
    ],
  },
};

// ---------- localStorage backend (demo / Vercel) ----------

function lsReadAll(): Memory[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Memory[];
  } catch {
    return [];
  }
}

function lsWriteAll(memories: Memory[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LS_KEY, JSON.stringify(memories));
}

function seedIfNeeded() {
  if (typeof window === "undefined") return;
  if (window.localStorage.getItem(LS_SEEDED) === "1") return;
  if (lsReadAll().length === 0) lsWriteAll([WELCOME]);
  window.localStorage.setItem(LS_SEEDED, "1");
}

function lsList(): MemorySummary[] {
  seedIfNeeded();
  return lsReadAll().map(summarize);
}

function lsGet(id: string): Memory | null {
  return lsReadAll().find((m) => m.id === id) ?? null;
}

function lsCreate(input: {
  title: string;
  body: string;
  category: MemoryCategory;
  tags: string[];
}): Memory {
  const all = lsReadAll();
  const base = slugify(input.title) || "memory";
  let id = base;
  let n = 2;
  while (all.some((m) => m.id === id)) id = `${base}-${n++}`;
  const now = new Date().toISOString();
  const relatedIds = findRelated(input, all);
  const m: Memory = {
    id,
    title: input.title,
    body: input.body,
    category: input.category,
    tags: input.tags,
    relatedIds,
    provenance: { createdAt: now, updatedAt: now, source: "demo" },
  };
  const next = [...all, m];
  // Backlink: any memory we linked TO also gets a backlink to us
  for (const rid of relatedIds) {
    const target = next.find((mm) => mm.id === rid);
    if (target && !target.relatedIds.includes(id)) {
      target.relatedIds = [...target.relatedIds, id];
    }
  }
  lsWriteAll(next);
  return m;
}

function lsDelete(id: string): boolean {
  const before = lsReadAll();
  const after = before.filter((m) => m.id !== id);
  if (after.length === before.length) return false;
  lsWriteAll(after);
  return true;
}

function lsSearch(q: string, limit: number): MemorySummary[] {
  const tokens = q.toLowerCase().split(/\s+/).filter((t) => t.length > 1);
  if (tokens.length === 0) return [];
  return lsReadAll()
    .map((m) => {
      const hay = `${m.title} ${m.body} ${m.tags.join(" ")}`.toLowerCase();
      let score = 0;
      for (const t of tokens) score += hay.split(t).length - 1;
      return { m, score };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((r) => summarize(r.m));
}

// ---------- API backend (local dev, file-backed) ----------

async function apiList(): Promise<MemorySummary[]> {
  const r = await fetch("/api/memories", { cache: "no-store" });
  const data: { memories: MemorySummary[] } = await r.json();
  return data.memories;
}

async function apiGet(id: string): Promise<Memory | null> {
  const r = await fetch(`/api/memories/${encodeURIComponent(id)}`);
  if (!r.ok) return null;
  const data: { memory: Memory } = await r.json();
  return data.memory;
}

async function apiCreate(input: {
  title: string;
  body: string;
  category: MemoryCategory;
  tags: string[];
}): Promise<Memory> {
  // Compute related from current pool so the server stores the edges
  const pool = await fetch("/api/memories", { cache: "no-store" })
    .then((r) => r.json() as Promise<{ memories: MemorySummary[] }>)
    .then((d) => d.memories.map((s) => ({ id: s.id, title: s.title, body: "", tags: s.tags })))
    .catch(() => [] as Pick<Memory, "id" | "title" | "body" | "tags">[]);
  const relatedIds = findRelated(input, pool);
  const r = await fetch("/api/memories", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...input, relatedIds }),
  });
  if (!r.ok) {
    const e = (await r.json().catch(() => ({}))) as { error?: string };
    throw new Error(e.error ?? `HTTP ${r.status}`);
  }
  // POST returns {memory: summary} — refetch full detail
  const data = (await r.json()) as { memory: MemorySummary };
  const full = await apiGet(data.memory.id);
  if (!full) throw new Error("Created but couldn't reload");
  return full;
}

async function apiDelete(id: string): Promise<boolean> {
  const r = await fetch(`/api/memories/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  return r.ok;
}

async function apiSearch(q: string, limit: number): Promise<MemorySummary[]> {
  const r = await fetch(
    `/api/search?q=${encodeURIComponent(q)}&limit=${limit}`,
  );
  if (!r.ok) return [];
  const data = (await r.json()) as { results: MemorySummary[] };
  return data.results;
}

// ---------- Public API ----------

export const isDemoMode = DEMO;

export async function listMemories(): Promise<MemorySummary[]> {
  return DEMO ? lsList() : apiList();
}

export async function getMemory(id: string): Promise<Memory | null> {
  return DEMO ? lsGet(id) : apiGet(id);
}

export async function createMemory(input: {
  title: string;
  body: string;
  category: MemoryCategory;
  tags: string[];
}): Promise<Memory> {
  return DEMO ? lsCreate(input) : apiCreate(input);
}

export async function deleteMemoryById(id: string): Promise<boolean> {
  return DEMO ? lsDelete(id) : apiDelete(id);
}

export async function searchMemories(
  q: string,
  limit = 5,
): Promise<MemorySummary[]> {
  return DEMO ? lsSearch(q, limit) : apiSearch(q, limit);
}
