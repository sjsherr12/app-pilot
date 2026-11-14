import Link from "next/link";
import { linkClass } from "@/components/ui";

export default function OrderNotFound() {
  return (
    <section className="max-w-prose">
      <h1 className="text-2xl font-semibold">Order not found</h1>
      <p className="mt-2 text-slate-700">
        We could not find that order. It may belong to a different account.
      </p>
      <p className="mt-4">
        <Link href="/orders" className={linkClass}>
          Back to your orders
        </Link>
      </p>
    </section>
  );
}
