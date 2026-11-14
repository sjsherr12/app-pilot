import { NextResponse } from "next/server";
import { exportTest, sleep } from "@/lib/mock/store";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Pretend git push + gh pr create take a moment.
  await sleep(2500);
  const result = exportTest(id);
  if (!result) return NextResponse.json({ detail: `Test ${id} not found` }, { status: 404 });
  return NextResponse.json(result);
}
