import Link from "next/link";
import { getCurrentUser, readCart } from "@/lib/auth";
import { cartItemCount } from "@/lib/store";

export async function SiteHeader() {
  const [user, cart] = await Promise.all([getCurrentUser(), readCart()]);
  const count = cartItemCount(cart);

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          Northstar Goods
        </Link>
        <nav aria-label="Main">
          <ul className="flex flex-wrap items-center gap-5 text-sm">
            <li>
              <Link href="/">Shop</Link>
            </li>
            <li>
              <Link href="/cart">Cart ({count})</Link>
            </li>
            <li>
              <Link href="/orders">Orders</Link>
            </li>
            <li>
              <Link href="/account">Account</Link>
            </li>
            <li>
              {user ? (
                <Link href="/logout">Sign out</Link>
              ) : (
                <Link href="/login">Sign in</Link>
              )}
            </li>
          </ul>
        </nav>
      </div>
    </header>
  );
}
