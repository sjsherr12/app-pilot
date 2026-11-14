import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Lockup } from "@/components/brand/logo";
import { REPO_URL } from "./site-nav";

const COLUMNS: { title: string; links: { label: string; href: string; external?: boolean }[] }[] = [
  {
    title: "Product",
    links: [
      { label: "How it works", href: "/#how-it-works" },
      { label: "Evidence", href: "/#evidence" },
      { label: "Regression tests", href: "/#regression" },
      { label: "Console", href: "/runs" },
    ],
  },
  {
    title: "Developers",
    links: [
      { label: "Source on GitHub", href: REPO_URL, external: true },
      { label: "README", href: `${REPO_URL}#readme`, external: true },
      { label: "API reference", href: "http://localhost:8000/docs", external: true },
      { label: "Playwright", href: "https://playwright.dev", external: true },
    ],
  },
  {
    title: "Platform",
    links: [
      { label: "Web (Playwright)", href: "/#product" },
      { label: "iOS · coming next", href: "/#product" },
      { label: "Android · coming next", href: "/#product" },
      { label: "CI via GitHub Actions", href: "/#regression" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "Built at HackPrinceton 2026", href: "https://hackprinceton.com", external: true },
      { label: "Brand", href: `${REPO_URL}/tree/main/apps/dashboard/public/brand`, external: true },
      { label: "Contact", href: "mailto:hello@apppilot.dev" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-card/30">
      <div className="mx-auto w-full max-w-[1400px] px-5 py-16 sm:px-8">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1.4fr)_repeat(4,minmax(0,1fr))]">
          <div className="flex flex-col gap-5">
            <Lockup className="h-6" />
            <p className="max-w-xs text-sm leading-6 text-muted-foreground">
              Test everything. Trust what ships. An autonomous QA engineer that explores your app, proves every bug in a clean
              environment, and hands you the failing test.
            </p>
            <div className="eyebrow inline-flex items-center gap-2">
              <span className="size-1.5 rounded-full bg-signal" />
              All systems operational
            </div>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.title} className="flex flex-col gap-3">
              <h3 className="eyebrow">{col.title}</h3>
              <ul className="flex flex-col gap-2">
                {col.links.map((l) =>
                  l.external ? (
                    <li key={l.label}>
                      <a
                        href={l.href}
                        target="_blank"
                        rel="noreferrer"
                        className="group inline-flex items-center gap-1 text-sm text-foreground/80 transition-colors duration-150 hover:text-foreground"
                      >
                        {l.label}
                        <ArrowUpRight className="size-3 text-muted-foreground opacity-0 transition-opacity duration-150 group-hover:opacity-100" />
                      </a>
                    </li>
                  ) : (
                    <li key={l.label}>
                      <Link href={l.href} className="text-sm text-foreground/80 transition-colors duration-150 hover:text-foreground">
                        {l.label}
                      </Link>
                    </li>
                  ),
                )}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-14 flex flex-col gap-3 border-t border-border pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>© 2026 AppPilot. Standard Playwright output, no proprietary test format.</span>
          <span className="eyebrow">Web today · iOS and Android next</span>
        </div>
      </div>
    </footer>
  );
}
