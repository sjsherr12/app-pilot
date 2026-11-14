import type { Metadata } from "next";
import Link from "next/link";
import { linkClass } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { formatDate, formatMoney } from "@/lib/format";
import { listUserOrders } from "@/lib/store";
import { getCurrentTenantState } from "@/lib/tenant";

export const metadata: Metadata = { title: "Orders" };

export default async function OrdersPage() {
  const user = await requireUser("/orders");
  const state = await getCurrentTenantState();
  const orders = listUserOrders(state, user.id);

  return (
    <section>
      <h1 className="text-2xl font-semibold">Your orders</h1>
      {orders.length === 0 ? (
        <>
          <p className="mt-4 text-slate-700">You have no orders yet.</p>
          <p className="mt-4">
            <Link href="/" className={linkClass}>
              Continue shopping
            </Link>
          </p>
        </>
      ) : (
        <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4">
          <table className="w-full border-collapse text-left text-sm">
            <caption className="sr-only">Your orders</caption>
            <thead>
              <tr className="border-b border-slate-200 text-slate-600">
                <th scope="col" className="py-2 pr-4 font-medium">
                  Order
                </th>
                <th scope="col" className="py-2 pr-4 font-medium">
                  Date
                </th>
                <th scope="col" className="py-2 pr-4 font-medium">
                  Items
                </th>
                <th scope="col" className="py-2 font-medium">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id} className="border-b border-slate-100">
                  <th scope="row" className="py-3 pr-4 font-medium">
                    <Link href={`/orders/${order.id}`} className={linkClass}>
                      Order #{order.id}
                    </Link>
                  </th>
                  <td className="py-3 pr-4">{formatDate(order.createdAt)}</td>
                  <td className="py-3 pr-4 tabular-nums">
                    {order.lines.reduce((n, l) => n + l.quantity, 0)}
                  </td>
                  <td className="py-3 tabular-nums">
                    {formatMoney(order.total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
