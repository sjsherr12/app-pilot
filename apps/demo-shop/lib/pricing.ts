import { getBugFlags, type BugFlags } from "./bugs";
import { getProduct } from "./products";
import type { Cart, OrderLine } from "./store";

/** Subtotals (before discount) at or above this ship free. In cents. */
export const FREE_SHIPPING_THRESHOLD = 5000;
/** Flat shipping fee below the threshold. In cents. */
export const SHIPPING_FEE = 599;
export const WELCOME_CODE = "WELCOME10";
export const WELCOME_PERCENT = 10;

export type Totals = {
  lines: OrderLine[];
  itemCount: number;
  subtotal: number;
  /** Applied coupon (only set when the discount actually applies). */
  coupon: string | null;
  discount: number;
  shipping: number;
  total: number;
};

/**
 * Line total for a cart line.
 *
 * Seeded bug `cart_quantity_total`: lines with quantity >= 3 contribute the
 * unit price once instead of unitPrice * quantity.
 */
export function lineTotalFor(
  unitPrice: number,
  quantity: number,
  flags: BugFlags = getBugFlags(),
): number {
  if (flags.cart_quantity_total && quantity >= 3) {
    return unitPrice * 1;
  }
  return unitPrice * quantity;
}

/** Whether WELCOME10 may be applied: it is valid on a customer's first order only. */
export function welcomeEligible(priorOrders: number): boolean {
  return priorOrders === 0;
}

export function computeTotals(
  cart: Cart,
  options: { priorOrders: number },
): Totals {
  const flags = getBugFlags();
  const lines: OrderLine[] = [];
  for (const line of cart.lines) {
    const product = getProduct(line.slug);
    if (!product) continue;
    lines.push({
      slug: product.slug,
      name: product.name,
      unitPrice: product.price,
      quantity: line.quantity,
      lineTotal: lineTotalFor(product.price, line.quantity, flags),
    });
  }
  const itemCount = lines.reduce((n, l) => n + l.quantity, 0);
  const subtotal = lines.reduce((n, l) => n + l.lineTotal, 0);

  const couponApplies =
    cart.coupon === WELCOME_CODE &&
    welcomeEligible(options.priorOrders) &&
    subtotal > 0;
  const discount = couponApplies
    ? Math.round((subtotal * WELCOME_PERCENT) / 100)
    : 0;

  const shipping =
    lines.length === 0 || subtotal >= FREE_SHIPPING_THRESHOLD
      ? 0
      : SHIPPING_FEE;

  return {
    lines,
    itemCount,
    subtotal,
    coupon: couponApplies ? WELCOME_CODE : null,
    discount,
    shipping,
    total: subtotal - discount + shipping,
  };
}
