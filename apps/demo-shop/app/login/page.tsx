import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { linkClass } from "@/components/ui";
import { getCurrentUser, safeNextPath } from "@/lib/auth";
import { DEMO_USER } from "@/lib/store";

export const metadata: Metadata = { title: "Sign in" };

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LoginPage({ searchParams }: Props) {
  const { next } = await searchParams;
  const nextPath = safeNextPath(Array.isArray(next) ? next[0] : next);
  if (await getCurrentUser()) {
    redirect(nextPath);
  }

  return (
    <section>
      <h1 className="text-2xl font-semibold">Sign in</h1>
      <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4">
        <LoginForm next={nextPath} />
      </div>
      <p className="mt-4 text-sm text-slate-700">
        New here?{" "}
        <Link href={`/register?next=${nextPath}`} className={linkClass}>
          Create an account
        </Link>
      </p>
      <p className="mt-2 text-sm text-slate-600">
        Demo account: {DEMO_USER.email} / {DEMO_USER.password}
      </p>
    </section>
  );
}
