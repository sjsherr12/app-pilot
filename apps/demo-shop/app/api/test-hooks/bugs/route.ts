import { NextResponse, type NextRequest } from "next/server";
import { getBugFlags, setBugFlags } from "@/lib/bugs";
import { testHooksEnabled, testHooksNotFound } from "@/lib/test-hooks";

export const dynamic = "force-dynamic";

/** GET /__test/bugs — current seeded-bug flags (global, not per tenant). */
export async function GET() {
  if (!testHooksEnabled()) return testHooksNotFound();
  return NextResponse.json(getBugFlags());
}

/** POST /__test/bugs — merges a partial {flag: boolean} body and returns all flags. */
export async function POST(request: NextRequest) {
  if (!testHooksEnabled()) return testHooksNotFound();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Body must be a JSON object of boolean flags" },
      { status: 400 },
    );
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return NextResponse.json(
      { error: "Body must be a JSON object of boolean flags" },
      { status: 400 },
    );
  }
  return NextResponse.json(setBugFlags(body as Record<string, unknown>));
}
