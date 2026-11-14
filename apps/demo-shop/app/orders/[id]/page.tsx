import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LinesTable } from "@/components/lines-table";
import { TotalsTable } from "@/components/totals-table";
import { linkClass } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { getUserOrder } from "@/lib/store";
import { getCurrentTenantState } from "@/lib/tenant";
import { parseOrderId } from "@/lib/order-id";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  return { title: parseOrderId(id) === null ? "Order not found" : `Order #${id}` };
}

export default async function OrderDetailPage({ params }: Props) {
  const { id } = await params;
  const user = await requireUser(`/orders/${id}`);
  const orderId = parseOrderId(id);
  if (orderId === null) {
    notFound();
  }
  const state = await getCurrentTenantState();
  const order = getUserOrder(state, user.id, orderId);
  if (!order) {
    notFound();
  }

  return (
    <section>
      <p className="text-sm">
        <Link href="/orders" className={linkClass}>
          Back to your orders
        </Link>
      </p>
      <h1 className="mt-2 text-2xl font-semibold">Order #{order.id}</h1>
      <dl className="mt-4 grid gap-x-8 gap-y-2 text-sm sm:grid-cols-[auto_1fr]">
        <dt className="font-medium text-slate-600">Status</dt>
        <dd>Confirmed</dd>
        <dt className="font-medium text-slate-600">Date</dt>
        <dd>{formatDate(order.createdAt)}</dd>
        <dt className="font-medium text-slate-600">Ship to</dt>
        <dd>
          {order.shippingAddress.fullName}, {order.shippingAddress.address},{" "}
          {order.shippingAddress.city} {order.shippingAddress.zip}
        </dd>
      </dl>
      <div className="mt-6 rounded-lg border border-slate-200 bg-white p-4">
        <LinesTable lines={order.lines} caption="Order items" />
        <div className="mt-4 flex justify-end">
          <TotalsTable totals={order} />
        </div>
      </div>
    </section>
  );
}
