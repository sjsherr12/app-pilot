import type { Metadata } from "next";
import Link from "next/link";
import { CouponForm } from "@/components/coupon-form";
import { LinesTable } from "@/components/lines-table";
import { TotalsTable } from "@/components/totals-table";
import { buttonClass, linkClass } from "@/components/ui";
import { getCurrentUser, readCart } from "@/lib/auth";
import { computeTotals } from "@/lib/pricing";
import { countUserOrders } from "@/lib/store";
import { getCurrentTenantState } from "@/lib/tenant";

export const metadata: Metadata = { title: "Cart" };

export default async function CartPage() {
  const [state, user, cart] = await Promise.all([
    getCurrentTenantState(),
    getCurrentUser(),
    readCart(),
  ]);
  const priorOrders = user ? countUserOrders(state, user.id) : 0;
  const totals = computeTotals(cart, { priorOrders });

  if (totals.lines.length === 0) {
    return (
      <section>
        <h1 className="text-2xl font-semibold">Your cart</h1>
        <p className="mt-4 text-slate-700">Your cart is empty.</p>
        <p className="mt-4">
          <Link href="/" className={linkClass}>
            Continue shopping
          </Link>
        </p>
      </section>
    );
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_20rem]">
      <section aria-labelledby="cart-heading">
        <h1 id="cart-heading" className="text-2xl font-semibold">
          Your cart
        </h1>
        <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4">
          <LinesTable lines={totals.lines} caption="Cart items" editable />
        </div>
        <section
          aria-labelledby="coupon-heading"
          className="mt-6 rounded-lg border border-slate-200 bg-white p-4"
        >
          <h2 id="coupon-heading" className="text-lg font-medium">
            Coupon
          </h2>
          <div className="mt-3">
            <CouponForm appliedCoupon={cart.coupon} />
          </div>
        </section>
      </section>

      <section
        aria-labelledby="summary-heading"
        className="self-start rounded-lg border border-slate-200 bg-white p-4"
      >
        <h2 id="summary-heading" className="text-lg font-medium">
          Order summary
        </h2>
        <div className="mt-3">
          <TotalsTable totals={totals} />
        </div>
        <p className="mt-3 text-sm text-slate-600">
          Prices include tax. Shipping is free on subtotals of $50.00 or more,
          otherwise $5.99.
        </p>
        <p className="mt-4">
          <Link href="/checkout" className={`${buttonClass} inline-block`}>
            Proceed to checkout
          </Link>
        </p>
      </section>
    </div>
  );
}
