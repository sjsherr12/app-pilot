import { NextResponse } from "next/server";
import { rerunTest, sleep } from "@/lib/mock/store";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Pretend Playwright takes a moment.
  await sleep(1500);
  const test = rerunTest(id);
  if (!test) return NextResponse.json({ detail: `Test ${id} not found` }, { status: 404 });
  return NextResponse.json(test);
}
