import { NextResponse } from "next/server";
import {
  loadAllMemories,
  memoryExists,
  slugify,
  summarize,
  writeMemory,
} from "@/lib/memories";
import { MEMORY_CATEGORIES, type Memory } from "@/lib/memory-types";

export const dynamic = "force-dynamic";

export async function GET() {
  const memories = await loadAllMemories();
  const summaries = memories.map(summarize);
  return NextResponse.json({ memories: summaries });
}

interface CreatePayload {
  title?: unknown;
  body?: unknown;
  category?: unknown;
  tags?: unknown;
  relatedIds?: unknown;
  id?: unknown;
}

export async function POST(req: Request) {
  let payload: CreatePayload;
  try {
    payload = (await req.json()) as CreatePayload;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const title = typeof payload.title === "string" ? payload.title.trim() : "";
  const body = typeof payload.body === "string" ? payload.body : "";
  const category =
    typeof payload.category === "string" ? payload.category : "";
  const tags = Array.isArray(payload.tags)
    ? payload.tags.filter((t): t is string => typeof t === "string")
    : [];
  const relatedIds = Array.isArray(payload.relatedIds)
    ? payload.relatedIds.filter((r): r is string => typeof r === "string")
    : [];

  if (!title) {
    return NextResponse.json({ error: "title required" }, { status: 400 });
  }
  if (!MEMORY_CATEGORIES.includes(category as (typeof MEMORY_CATEGORIES)[number])) {
    return NextResponse.json(
      { error: `category must be one of ${MEMORY_CATEGORIES.join(", ")}` },
      { status: 400 },
    );
  }

  const requestedId =
    typeof payload.id === "string" && payload.id.trim()
      ? slugify(payload.id)
      : slugify(title);
  if (!requestedId) {
    return NextResponse.json({ error: "id resolves to empty" }, { status: 400 });
  }

  // Avoid clobbering existing memories.
  let id = requestedId;
  let suffix = 2;
  while (await memoryExists(id)) {
    id = `${requestedId}-${suffix}`;
    suffix++;
  }

  const now = new Date().toISOString();
  const memory: Memory = {
    id,
    title,
    body,
    category: category as Memory["category"],
    tags,
    relatedIds,
    provenance: {
      createdAt: now,
      updatedAt: now,
      source: "dashboard",
    },
  };

  await writeMemory(memory);
  return NextResponse.json({ memory: summarize(memory) }, { status: 201 });
}
