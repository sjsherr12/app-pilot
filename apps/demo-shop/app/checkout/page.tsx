import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CheckoutForm } from "@/components/checkout-form";
import { LinesTable } from "@/components/lines-table";
import { TotalsTable } from "@/components/totals-table";
import { requireUser } from "@/lib/auth";
import { computeTotals } from "@/lib/pricing";
import { countUserOrders, peekCart, userCartKey } from "@/lib/store";
import { getCurrentTenantState } from "@/lib/tenant";

export const metadata: Metadata = { title: "Checkout" };

export default async function CheckoutPage() {
  const user = await requireUser("/checkout");
  const state = await getCurrentTenantState();
  const cart = peekCart(state, userCartKey(user.id));
  if (cart.lines.length === 0) {
    redirect("/cart");
  }
  const totals = computeTotals(cart, {
    priorOrders: countUserOrders(state, user.id),
  });

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_20rem]">
      <section aria-labelledby="checkout-heading">
        <h1 id="checkout-heading" className="text-2xl font-semibold">
          Checkout
        </h1>
        <p className="mt-1 text-slate-600">
          Signed in as {user.email}. Enter the shipping details for this order.
        </p>
        <div className="mt-6 rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="text-lg font-medium">Shipping details</h2>
          <div className="mt-3">
            <CheckoutForm fullName={user.displayName} />
          </div>
        </div>
      </section>

      <section
        aria-labelledby="checkout-summary-heading"
        className="self-start rounded-lg border border-slate-200 bg-white p-4"
      >
        <h2 id="checkout-summary-heading" className="text-lg font-medium">
          Order summary
        </h2>
        <div className="mt-3">
          <LinesTable lines={totals.lines} caption="Items in this order" />
        </div>
        <div className="mt-4">
          <TotalsTable totals={totals} />
        </div>
        <p className="mt-3 text-sm text-slate-600">Prices include tax.</p>
      </section>
    </div>
  );
}
