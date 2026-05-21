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
    relatedIds: m.relatedIds,
    hasChat: Boolean(m.chat?.preview),
  };
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export async function writeMemory(memory: Memory): Promise<void> {
  await fs.mkdir(MEMORIES_DIR, { recursive: true });
  const filePath = path.join(MEMORIES_DIR, `${memory.id}.json`);
  await fs.writeFile(filePath, JSON.stringify(memory, null, 2), "utf-8");
}

export async function deleteMemory(id: string): Promise<boolean> {
  const filePath = path.join(MEMORIES_DIR, `${id}.json`);
  try {
    await fs.unlink(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function memoryExists(id: string): Promise<boolean> {
  const filePath = path.join(MEMORIES_DIR, `${id}.json`);
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}
