import { NextResponse } from "next/server";
import { loadAllMemories, summarize } from "@/lib/memories";

export const dynamic = "force-dynamic";

export async function GET() {
  const memories = await loadAllMemories();
  const summaries = memories.map(summarize);
  return NextResponse.json({ memories: summaries });
}
