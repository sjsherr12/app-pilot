import { cookies } from "next/headers";
import { getTenantState, type TenantState } from "./store";

export const TENANT_COOKIE = "apx_tenant";
export const DEFAULT_TENANT = "default";

const TENANT_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

/** Returns a safe tenant id, falling back to "default" for missing/invalid values. */
export function normalizeTenant(raw: string | null | undefined): string {
  const value = (raw ?? "").trim();
  return TENANT_PATTERN.test(value) ? value : DEFAULT_TENANT;
}

/** The tenant for the current request, from the `apx_tenant` cookie. */
export async function getTenant(): Promise<string> {
  const jar = await cookies();
  return normalizeTenant(jar.get(TENANT_COOKIE)?.value);
}

/** State for the current request's tenant (seeded on first access). */
export async function getCurrentTenantState(): Promise<TenantState> {
  return getTenantState(await getTenant());
}
