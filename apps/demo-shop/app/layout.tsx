import type { Metadata } from "next";
import type { ReactNode } from "react";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

// Every page reads the tenant and session cookies, so the whole app renders
// per request. Stating it explicitly keeps the build output predictable.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: {
    default: "Northstar Goods",
    template: "%s · Northstar Goods",
  },
  description: "Everyday home and travel goods.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-10 focus:rounded focus:bg-white focus:px-3 focus:py-2 focus:outline-2 focus:outline-slate-900"
        >
          Skip to main content
        </a>
        <SiteHeader />
        <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
          {children}
        </main>
        <footer className="border-t border-slate-200 bg-white">
          <div className="mx-auto max-w-5xl px-4 py-4 text-sm text-slate-600">
            Northstar Goods · All prices include tax · Free shipping on
            subtotals of $50.00 or more
          </div>
        </footer>
      </body>
    </html>
  );
}
