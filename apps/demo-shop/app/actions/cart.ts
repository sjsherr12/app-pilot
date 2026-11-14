"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import {
  COOKIE_OPTIONS,
  GUEST_CART_COOKIE,
  getCartKey,
  getCurrentUser,
} from "@/lib/auth";
import { WELCOME_CODE, welcomeEligible } from "@/lib/pricing";
import { getProduct } from "@/lib/products";
import {
  MAX_QUANTITY,
  addToCart as addLine,
  changeQuantity as changeLineQuantity,
  countUserOrders,
  getOrCreateCart,
  guestCartKey,
  removeLine as removeCartLine,
} from "@/lib/store";
import { getCurrentTenantState } from "@/lib/tenant";
import type { FormState } from "./form-state";

/** Cart key for a mutation; creates the guest-cart cookie when there is none yet. */
async function ensureCartKey(): Promise<string> {
  const existing = await getCartKey();
  if (existing) return existing;
  const token = crypto.randomUUID();
  const jar = await cookies();
  jar.set(GUEST_CART_COOKIE, token, COOKIE_OPTIONS);
  return guestCartKey(token);
}

export async function addToCart(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const product = getProduct(String(formData.get("slug") ?? ""));
  if (!product) {
    return { ok: false, message: "Unknown product" };
  }
  const rawQuantity = formData.get("quantity");
  const quantity =
    rawQuantity === null || rawQuantity === "" ? 1 : Number(rawQuantity);
  if (
    !Number.isInteger(quantity) ||
    quantity < 1 ||
    quantity > MAX_QUANTITY
  ) {
    return {
      ok: false,
      message: `Enter a quantity between 1 and ${MAX_QUANTITY}`,
    };
  }

  const state = await getCurrentTenantState();
  const cart = getOrCreateCart(state, await ensureCartKey());
  addLine(cart, product.slug, quantity);
  revalidatePath("/", "layout");
  return {
    ok: true,
    message:
      quantity === 1
        ? `Added ${product.name} to cart`
        : `Added ${quantity} × ${product.name} to cart`,
  };
}

export async function changeQuantity(formData: FormData): Promise<void> {
  const slug = String(formData.get("slug") ?? "");
  const delta = Number(formData.get("delta"));
  if (!getProduct(slug) || !Number.isInteger(delta) || delta === 0) return;
  const key = await getCartKey();
  if (!key) return;
  const state = await getCurrentTenantState();
  changeLineQuantity(getOrCreateCart(state, key), slug, delta);
  revalidatePath("/", "layout");
}

export async function removeLine(formData: FormData): Promise<void> {
  const slug = String(formData.get("slug") ?? "");
  const key = await getCartKey();
  if (!key) return;
  const state = await getCurrentTenantState();
  removeCartLine(getOrCreateCart(state, key), slug);
  revalidatePath("/", "layout");
}

/**
 * Handles both submit buttons of the coupon form: intent "apply" (default)
 * and intent "remove".
 */
export async function couponAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const intent = String(formData.get("intent") ?? "apply");
  const state = await getCurrentTenantState();

  if (intent === "remove") {
    const key = await getCartKey();
    const cart = key ? state.carts.get(key) : undefined;
    if (cart) cart.coupon = null;
    revalidatePath("/", "layout");
    return { ok: true, message: "Coupon removed" };
  }

  const code = String(formData.get("code") ?? "")
    .trim()
    .toUpperCase();
  if (!code) {
    return { ok: false, message: "Enter a coupon code" };
  }
  if (code !== WELCOME_CODE) {
    return { ok: false, message: "Invalid coupon code" };
  }

  // WELCOME10 is a first-order coupon. Guests count as first-time customers
  // until they sign in (eligibility is re-checked when carts merge and at checkout).
  const user = await getCurrentUser();
  const priorOrders = user ? countUserOrders(state, user.id) : 0;
  if (!welcomeEligible(priorOrders)) {
    return {
      ok: false,
      message: "WELCOME10 is valid on your first order only",
    };
  }

  const cart = getOrCreateCart(state, await ensureCartKey());
  if (cart.lines.length === 0) {
    return { ok: false, message: "Your cart is empty" };
  }
  cart.coupon = WELCOME_CODE;
  revalidatePath("/", "layout");
  return { ok: true, message: "Coupon WELCOME10 applied" };
}
