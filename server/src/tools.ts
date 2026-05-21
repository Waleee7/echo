import { z } from "zod";
import { MemoryStore } from "./storage.js";
import { MEMORY_CATEGORIES } from "./types.js";

export const memoryStore = new MemoryStore();

const categoryEnum = z.enum(MEMORY_CATEGORIES);

export const saveMemoryShape = {
  id: z
    .string()
    .min(1)
    .describe("Stable kebab-case slug, unique. Example: 'user-favorite-editor'"),
  title: z.string().min(1).describe("Short human-readable title"),
  body: z.string().min(1).describe("Full memory body in markdown"),
  category: categoryEnum,
  tags: z.array(z.string()).optional(),
  relatedIds: z
    .array(z.string())
    .optional()
    .describe("Slugs of related memories"),
  source: z
    .string()
    .optional()
    .describe("Free-text source — e.g. 'conversation 2026-05-20'"),
  sessionId: z.string().optional(),
};

export const recallShape = {
  id: z.string().describe("Memory ID to recall"),
};

export const searchShape = {
  query: z.string().describe("Free text search query"),
  limit: z.number().int().min(1).max(50).optional(),
};

export const listShape = {
  category: categoryEnum
    .optional()
    .describe("Optional category filter"),
};

export const forgetShape = {
  id: z.string().describe("Memory ID to delete"),
};

type SaveMemoryArgs = {
  [K in keyof typeof saveMemoryShape]: z.infer<(typeof saveMemoryShape)[K]>;
};
type RecallArgs = { [K in keyof typeof recallShape]: z.infer<(typeof recallShape)[K]> };
type SearchArgs = { [K in keyof typeof searchShape]: z.infer<(typeof searchShape)[K]> };
type ListArgs = { [K in keyof typeof listShape]: z.infer<(typeof listShape)[K]> };
type ForgetArgs = { [K in keyof typeof forgetShape]: z.infer<(typeof forgetShape)[K]> };

export async function handleSaveMemory(input: SaveMemoryArgs) {
  const memory = await memoryStore.save(input);
  return {
    content: [
      {
        type: "text" as const,
        text: `Saved memory: ${memory.id} (${memory.category})`,
      },
    ],
  };
}

export async function handleRecall(input: RecallArgs) {
  const memory = await memoryStore.get(input.id);
  if (!memory) {
    return {
      content: [
        { type: "text" as const, text: `No memory found with id: ${input.id}` },
      ],
      isError: true,
    };
  }
  const header = `# ${memory.title}\n\n_Category: ${memory.category} · Updated: ${memory.provenance.updatedAt}_`;
  return {
    content: [
      { type: "text" as const, text: `${header}\n\n${memory.body}` },
    ],
  };
}

export async function handleSearch(input: SearchArgs) {
  const results = await memoryStore.search(input.query, input.limit ?? 10);
  if (results.length === 0) {
    return {
      content: [
        { type: "text" as const, text: `No matches for "${input.query}"` },
      ],
    };
  }
  const lines = results.map(
    (r) =>
      `- **${r.title}** (${r.id}) · ${r.category}${r.snippet ? `\n  ${r.snippet}` : ""}`,
  );
  return {
    content: [{ type: "text" as const, text: lines.join("\n") }],
  };
}

export async function handleList(input: ListArgs) {
  const items = await memoryStore.list(input.category);
  if (items.length === 0) {
    return {
      content: [{ type: "text" as const, text: "No memories stored yet." }],
    };
  }
  const lines = items
    .sort((a, b) => b.freshness - a.freshness)
    .map(
      (i) =>
        `- ${i.title} (${i.id}) · ${i.category} · freshness ${i.freshness.toFixed(2)}`,
    );
  return {
    content: [{ type: "text" as const, text: lines.join("\n") }],
  };
}

export async function handleForget(input: ForgetArgs) {
  const ok = await memoryStore.forget(input.id);
  return {
    content: [
      {
        type: "text" as const,
        text: ok
          ? `Forgotten: ${input.id}`
          : `Nothing to forget — id not found: ${input.id}`,
      },
    ],
  };
}
