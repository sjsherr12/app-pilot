"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { computeTotals } from "@/lib/pricing";
import {
  countUserOrders,
  createOrder,
  emptyCart,
  userCartKey,
} from "@/lib/store";
import { getCurrentTenantState } from "@/lib/tenant";
import type { FormState } from "./form-state";

export async function placeOrder(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login?next=/checkout");
  }

  const fullName = String(formData.get("fullName") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim();
  const zip = String(formData.get("zip") ?? "").trim();
  if (!fullName || !address || !city || !zip) {
    return { ok: false, message: "Please fill in all fields" };
  }

  const state = await getCurrentTenantState();
  const key = userCartKey(user.id);
  const cart = state.carts.get(key);
  if (!cart || cart.lines.length === 0) {
    redirect("/cart");
  }

  const totals = computeTotals(cart, {
    priorOrders: countUserOrders(state, user.id),
  });
  const order = createOrder(state, {
    userId: user.id,
    lines: totals.lines,
    subtotal: totals.subtotal,
    discount: totals.discount,
    shipping: totals.shipping,
    total: totals.total,
    coupon: totals.coupon,
    shippingAddress: { fullName, address, city, zip },
  });
  state.carts.set(key, emptyCart());
  revalidatePath("/", "layout");
  redirect(`/orders/confirmation/${order.id}`);
}
