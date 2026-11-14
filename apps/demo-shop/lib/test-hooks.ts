import { NextResponse } from "next/server";

/** Test hooks are only mounted when the server runs with APX_TEST_HOOKS=1. */
export function testHooksEnabled(): boolean {
  return process.env.APX_TEST_HOOKS === "1";
}

export function testHooksNotFound(): NextResponse {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}
