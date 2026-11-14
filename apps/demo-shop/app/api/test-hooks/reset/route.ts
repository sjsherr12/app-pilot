import { NextResponse, type NextRequest } from "next/server";
import { resetTenant } from "@/lib/store";
import { DEFAULT_TENANT, normalizeTenant } from "@/lib/tenant";
import { testHooksEnabled, testHooksNotFound } from "@/lib/test-hooks";

export const dynamic = "force-dynamic";

/** POST /__test/reset?tenant=X — resets that tenant to seed state. */
export async function POST(request: NextRequest) {
  if (!testHooksEnabled()) return testHooksNotFound();

  const raw = request.nextUrl.searchParams.get("tenant");
  const tenant = raw === null || raw === "" ? DEFAULT_TENANT : normalizeTenant(raw);
  if (raw && tenant !== raw) {
    return NextResponse.json(
      { ok: false, error: "Invalid tenant: use 1-64 letters, digits, '_' or '-'" },
      { status: 400 },
    );
  }

  resetTenant(tenant);
  return NextResponse.json({ ok: true, tenant });
}
