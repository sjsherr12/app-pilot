import { NextResponse } from "next/server";
import { getRunDetail } from "@/lib/mock/store";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = getRunDetail(id);
  if (!detail) return NextResponse.json({ detail: `Run ${id} not found` }, { status: 404 });
  return NextResponse.json(detail);
}
