import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { RegisterForm } from "@/components/register-form";
import { linkClass } from "@/components/ui";
import { getCurrentUser, safeNextPath } from "@/lib/auth";

export const metadata: Metadata = { title: "Create account" };

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function RegisterPage({ searchParams }: Props) {
  const { next } = await searchParams;
  const nextPath = safeNextPath(Array.isArray(next) ? next[0] : next);
  if (await getCurrentUser()) {
    redirect(nextPath);
  }

  return (
    <section>
      <h1 className="text-2xl font-semibold">Create account</h1>
      <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4">
        <RegisterForm next={nextPath} />
      </div>
      <p className="mt-4 text-sm text-slate-700">
        Already have an account?{" "}
        <Link href={`/login?next=${nextPath}`} className={linkClass}>
          Sign in
        </Link>
      </p>
    </section>
  );
}
