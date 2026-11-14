import Link from "next/link";
import { linkClass } from "@/components/ui";

export default function NotFound() {
  return (
    <section className="max-w-prose">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="mt-2 text-slate-700">
        The page you asked for does not exist.
      </p>
      <p className="mt-4">
        <Link href="/" className={linkClass}>
          Back to the shop
        </Link>
      </p>
    </section>
  );
}
