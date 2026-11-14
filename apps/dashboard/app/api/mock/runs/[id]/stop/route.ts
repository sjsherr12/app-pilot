import { NextResponse } from "next/server";
import { stopRun } from "@/lib/mock/store";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const run = stopRun(id);
  if (!run) return NextResponse.json({ detail: `Run ${id} not found` }, { status: 404 });
  return NextResponse.json(run);
}
