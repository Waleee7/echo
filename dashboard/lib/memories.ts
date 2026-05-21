/**
 * Server-only memory loading. Reads from ~/.echo/memories/.
 * Do NOT import this from client components — use lib/memory-types.ts for types.
 */
import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  computeFreshness,
  type Memory,
  type MemorySummary,
} from "./memory-types";

const ECHO_DIR =
  process.env.ECHO_DIR ?? path.join(os.homedir(), ".echo");
const MEMORIES_DIR = path.join(ECHO_DIR, "memories");

export async function loadAllMemories(): Promise<Memory[]> {
  try {
    await fs.mkdir(MEMORIES_DIR, { recursive: true });
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
        // Skip corrupt files.
      }
    }
    return memories;
  } catch {
    return [];
  }
}

export function summarize(m: Memory): MemorySummary {
  return {
    id: m.id,
    title: m.title,
    category: m.category,
    tags: m.tags,
    updatedAt: m.provenance.updatedAt,
    freshness: computeFreshness(m.provenance.updatedAt),
  };
}
