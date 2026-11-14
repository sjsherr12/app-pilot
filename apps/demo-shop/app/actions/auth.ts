"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  COOKIE_OPTIONS,
  GUEST_CART_COOKIE,
  SESSION_COOKIE,
  safeNextPath,
} from "@/lib/auth";
import {
  createSession,
  createUser,
  deleteSession,
  findUserByEmail,
  guestCartKey,
  mergeGuestCartIntoUser,
  type TenantState,
} from "@/lib/store";
import { getCurrentTenantState } from "@/lib/tenant";
import type { FormState } from "./form-state";

const MIN_PASSWORD_LENGTH = 6;

/** Starts a session, merging any guest cart into the user's cart. */
async function signIn(state: TenantState, userId: string) {
  const jar = await cookies();
  const guestToken = jar.get(GUEST_CART_COOKIE)?.value;
  mergeGuestCartIntoUser(
    state,
    guestToken ? guestCartKey(guestToken) : null,
    userId,
  );
  deleteSession(state, jar.get(SESSION_COOKIE)?.value);
  const token = createSession(state, userId);
  jar.set(SESSION_COOKIE, token, COOKIE_OPTIONS);
  if (guestToken) jar.delete(GUEST_CART_COOKIE);
  revalidatePath("/", "layout");
}

export async function login(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = safeNextPath(formData.get("next"));

  const state = await getCurrentTenantState();
  const user = findUserByEmail(state, email);
  if (!user || user.password !== password) {
    return { ok: false, message: "Invalid email or password" };
  }
  await signIn(state, user.id);
  redirect(next);
}

export async function register(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const displayName = String(formData.get("displayName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = safeNextPath(formData.get("next"));

  if (!displayName || !email || !password) {
    return { ok: false, message: "Please fill in all fields" };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, message: "Enter a valid email address" };
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return {
      ok: false,
      message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
    };
  }

  const state = await getCurrentTenantState();
  if (findUserByEmail(state, email)) {
    return {
      ok: false,
      message: "An account with this email already exists",
    };
  }
  const user = createUser(state, { email, password, displayName });
  await signIn(state, user.id);
  redirect(next);
}

export async function logout(): Promise<void> {
  const state = await getCurrentTenantState();
  const jar = await cookies();
  deleteSession(state, jar.get(SESSION_COOKIE)?.value);
  jar.delete(SESSION_COOKIE);
  revalidatePath("/", "layout");
  redirect("/");
}
