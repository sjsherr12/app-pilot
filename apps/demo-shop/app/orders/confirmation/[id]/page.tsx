import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LinesTable } from "@/components/lines-table";
import { TotalsTable } from "@/components/totals-table";
import { buttonClass, linkClass } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getBugFlags } from "@/lib/bugs";
import { parseOrderId } from "@/lib/order-id";
import { getUserOrder } from "@/lib/store";
import { getCurrentTenantState } from "@/lib/tenant";

type Props = { params: Promise<{ id: string }> };

export const metadata: Metadata = { title: "Order confirmed" };

export default async function OrderConfirmationPage({ params }: Props) {
  const { id } = await params;
  const user = await requireUser(`/orders/confirmation/${id}`);
  const orderId = parseOrderId(id);
  if (orderId === null) {
    notFound();
  }
  const state = await getCurrentTenantState();
  const order = getUserOrder(state, user.id, orderId);
  if (!order) {
    notFound();
  }

  // Seeded bug `first_order_link_404`: the link targets the previous order id,
  // so a customer's first order links to /orders/0.
  const viewOrderHref = getBugFlags().first_order_link_404
    ? `/orders/${order.id - 1}`
    : `/orders/${order.id}`;

  return (
    <section>
      <h1 className="text-2xl font-semibold">Thank you for your order</h1>
      <p className="mt-2 text-slate-700">
        Your order number is <strong>#{order.id}</strong>. We will ship it to{" "}
        {order.shippingAddress.fullName}, {order.shippingAddress.address},{" "}
        {order.shippingAddress.city} {order.shippingAddress.zip}.
      </p>
      <div className="mt-6 rounded-lg border border-slate-200 bg-white p-4">
        <LinesTable lines={order.lines} caption="Order items" />
        <div className="mt-4 flex justify-end">
          <TotalsTable totals={order} />
        </div>
      </div>
      <p className="mt-6 flex flex-wrap items-center gap-4">
        <Link href={viewOrderHref} className={`${buttonClass} inline-block`}>
          View order
        </Link>
        <Link href="/" className={linkClass}>
          Continue shopping
        </Link>
      </p>
    </section>
  );
}
