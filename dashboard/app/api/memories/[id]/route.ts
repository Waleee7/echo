import { NextResponse } from "next/server";
import { loadAllMemories } from "@/lib/memories";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const memories = await loadAllMemories();
  const found = memories.find((m) => m.id === id);
  if (!found) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json({ memory: found });
}
