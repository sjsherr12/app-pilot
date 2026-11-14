import type { Metadata } from "next";
import { AccountForm } from "@/components/account-form";
import { requireUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Account" };

export default async function AccountPage() {
  const user = await requireUser("/account");

  return (
    <section>
      <h1 className="text-2xl font-semibold">Account</h1>
      <p className="mt-1 text-slate-600">Signed in as {user.email}.</p>
      <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-lg font-medium">Profile</h2>
        <div className="mt-3">
          <AccountForm
            displayName={user.displayName}
            marketingOptIn={user.marketingOptIn}
          />
        </div>
      </div>
    </section>
  );
}
