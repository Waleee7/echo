import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import type {
  Memory,
  MemoryCategory,
  MemorySummary,
  SearchResult,
} from "./types.js";

const ECHO_DIR =
  process.env.ECHO_DIR ?? path.join(os.homedir(), ".echo");
const MEMORIES_DIR = path.join(ECHO_DIR, "memories");

export interface SaveInput {
  id: string;
  title: string;
  body: string;
  category: MemoryCategory;
  tags?: string[];
  relatedIds?: string[];
  source?: string;
  sessionId?: string;
}

export class MemoryStore {
  async init(): Promise<void> {
    await fs.mkdir(MEMORIES_DIR, { recursive: true });
  }

  async list(category?: MemoryCategory): Promise<MemorySummary[]> {
    const all = await this.loadAll();
    const filtered = category
      ? all.filter((m) => m.category === category)
      : all;
    return filtered.map(toSummary);
  }

  async get(id: string): Promise<Memory | null> {
    const filePath = path.join(MEMORIES_DIR, `${id}.json`);
    try {
      const raw = await fs.readFile(filePath, "utf-8");
      return JSON.parse(raw) as Memory;
    } catch (err: unknown) {
      if (isENOENT(err)) return null;
      throw err;
    }
  }

  async save(input: SaveInput): Promise<Memory> {
    await this.init();
    const now = new Date().toISOString();
    const existing = await this.get(input.id);
    const memory: Memory = {
      id: input.id,
      title: input.title,
      body: input.body,
      category: input.category,
      tags: input.tags ?? [],
      relatedIds: input.relatedIds ?? [],
      provenance: {
        createdAt: existing?.provenance.createdAt ?? now,
        updatedAt: now,
        source: input.source ?? existing?.provenance.source,
        sessionId: input.sessionId ?? existing?.provenance.sessionId,
      },
    };
    const filePath = path.join(MEMORIES_DIR, `${memory.id}.json`);
    await fs.writeFile(filePath, JSON.stringify(memory, null, 2), "utf-8");
    return memory;
  }

  async forget(id: string): Promise<boolean> {
    const filePath = path.join(MEMORIES_DIR, `${id}.json`);
    try {
      await fs.unlink(filePath);
      return true;
    } catch (err: unknown) {
      if (isENOENT(err)) return false;
      throw err;
    }
  }

  async search(query: string, limit = 10): Promise<SearchResult[]> {
    const all = await this.loadAll();
    const q = query.toLowerCase().trim();
    if (!q) return [];

    const scored = all.map((m) => {
      const haystack =
        `${m.title} ${m.body} ${m.tags.join(" ")}`.toLowerCase();
      const score = scoreMatch(haystack, q);
      const snippet = getSnippet(m.body, q);
      return { memory: m, score, snippet };
    });

    return scored
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((s) => ({
        ...toSummary(s.memory),
        score: s.score,
        snippet: s.snippet,
      }));
  }

  private async loadAll(): Promise<Memory[]> {
    await this.init();
    const files = await fs.readdir(MEMORIES_DIR);
    const memories: Memory[] = [];
    for (const file of files) {
      if (!file.endsWith(".json")) continue;
      try {
        const raw = await fs.readFile(
          path.join(MEMORIES_DIR, file),
          "utf-8",
        );
        memories.push(JSON.parse(raw) as Memory);
      } catch {
        // Skip corrupt files rather than fail the whole list.
      }
    }
    return memories;
  }
}

function toSummary(m: Memory): MemorySummary {
  return {
    id: m.id,
    title: m.title,
    category: m.category,
    tags: m.tags,
    updatedAt: m.provenance.updatedAt,
    freshness: computeFreshness(m.provenance.updatedAt),
  };
}

// Exponential decay with ~30-day half-life.
function computeFreshness(updatedAt: string): number {
  const ageDays =
    (Date.now() - new Date(updatedAt).getTime()) / 86_400_000;
  return Math.max(0, Math.min(1, Math.exp(-ageDays / 43.3)));
}

function scoreMatch(haystack: string, query: string): number {
  const tokens = query.split(/\s+/).filter(Boolean);
  let score = 0;
  for (const t of tokens) {
    const matches = haystack.split(t).length - 1;
    score += matches;
  }
  return score;
}

function getSnippet(
  body: string,
  query: string,
  around = 60,
): string | undefined {
  const firstToken = query.split(/\s+/)[0] ?? "";
  if (!firstToken) return undefined;
  const idx = body.toLowerCase().indexOf(firstToken);
  if (idx < 0) return undefined;
  const start = Math.max(0, idx - around);
  const end = Math.min(body.length, idx + query.length + around);
  return (
    (start > 0 ? "…" : "") +
    body.slice(start, end).replace(/\s+/g, " ").trim() +
    (end < body.length ? "…" : "")
  );
}

function isENOENT(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: string }).code === "ENOENT"
  );
}

export { ECHO_DIR, MEMORIES_DIR };
