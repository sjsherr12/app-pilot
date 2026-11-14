import type { Metadata } from "next";
import Link from "next/link";
import { logout } from "@/app/actions/auth";
import { buttonClass, linkClass } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Sign out" };

export default async function LogoutPage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <section>
        <h1 className="text-2xl font-semibold">Sign out</h1>
        <p className="mt-4 text-slate-700">You are not signed in.</p>
        <p className="mt-4">
          <Link href="/login" className={linkClass}>
            Sign in
          </Link>
        </p>
      </section>
    );
  }

  return (
    <section>
      <h1 className="text-2xl font-semibold">Sign out</h1>
      <p className="mt-4 text-slate-700">You are signed in as {user.email}.</p>
      <form action={logout} className="mt-4">
        <button type="submit" className={buttonClass}>
          Sign out
        </button>
      </form>
    </section>
  );
}
