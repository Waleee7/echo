import { NextResponse } from "next/server";
import { loadAllMemories, summarize } from "@/lib/memories";

export const dynamic = "force-dynamic";

function score(haystack: string, query: string): number {
  const tokens = query
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 1);
  if (tokens.length === 0) return 0;
  const h = haystack.toLowerCase();
  let s = 0;
  for (const t of tokens) {
    const matches = h.split(t).length - 1;
    s += matches;
  }
  return s;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = url.searchParams.get("q") ?? "";
  const limit = Math.max(
    1,
    Math.min(50, Number(url.searchParams.get("limit") ?? "10")),
  );

  if (!q.trim()) {
    return NextResponse.json({ results: [] });
  }

  const memories = await loadAllMemories();
  const ranked = memories
    .map((m) => {
      const haystack = `${m.title} ${m.body} ${m.tags.join(" ")}`;
      return { memory: m, score: score(haystack, q) };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((r) => summarize(r.memory));

  return NextResponse.json({ results: ranked });
}
