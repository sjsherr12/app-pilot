import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  getSessionUser,
  guestCartKey,
  peekCart,
  userCartKey,
  type Cart,
  type User,
} from "./store";
import { getCurrentTenantState } from "./tenant";

export const SESSION_COOKIE = "apx_session";
export const GUEST_CART_COOKIE = "apx_cart";

export const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax",
  path: "/",
} as const;

/** The signed-in user for this request's tenant, or null. */
export async function getCurrentUser(): Promise<User | null> {
  const state = await getCurrentTenantState();
  const jar = await cookies();
  return getSessionUser(state, jar.get(SESSION_COOKIE)?.value) ?? null;
}

/** Redirects guests to the sign-in page, returning to `nextPath` afterwards. */
export async function requireUser(nextPath: string): Promise<User> {
  const user = await getCurrentUser();
  if (!user) {
    redirect(`/login?next=${nextPath}`);
  }
  return user;
}

/** Only same-origin absolute paths are accepted as post-login destinations. */
export function safeNextPath(raw: unknown, fallback = "/"): string {
  if (typeof raw !== "string") return fallback;
  if (!raw.startsWith("/") || raw.startsWith("//")) return fallback;
  return raw;
}

/** The cart key for this request: the user's cart, else the guest cart cookie, else null. */
export async function getCartKey(): Promise<string | null> {
  const user = await getCurrentUser();
  if (user) return userCartKey(user.id);
  const jar = await cookies();
  const guestToken = jar.get(GUEST_CART_COOKIE)?.value;
  return guestToken ? guestCartKey(guestToken) : null;
}

/** Read-only view of the current cart (never creates one). */
export async function readCart(): Promise<Cart> {
  const state = await getCurrentTenantState();
  return peekCart(state, await getCartKey());
}
