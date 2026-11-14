import { NextResponse } from "next/server";
import { createRun, listRuns } from "@/lib/mock/store";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ runs: listRuns() });
}

export async function POST(req: Request) {
  let body: { app_url?: string; objective?: string; product_notes?: string } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ detail: "Invalid JSON body" }, { status: 400 });
  }
  if (!body.app_url || !body.objective) {
    return NextResponse.json({ detail: "app_url and objective are required" }, { status: 422 });
  }
  const run = createRun({ app_url: body.app_url, objective: body.objective, product_notes: body.product_notes });
  return NextResponse.json(run, { status: 201 });
}
