"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/brand/logo";

export const REPO_URL = "https://github.com/sjsherr12/app-pilot";

const LINKS = [
  { href: "/#product", label: "Product" },
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#evidence", label: "Evidence" },
  { href: "/#regression", label: "Regression tests" },
];

/** Public-site nav: transparent over the hero, then a blurred Ink bar with a hairline once the page scrolls. */
export function SiteNav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header
      className={cn(
        "sticky top-0 z-40 transition-[background-color,border-color,backdrop-filter] duration-200",
        scrolled || open ? "border-b border-border bg-background/85 backdrop-blur-md" : "border-b border-transparent bg-transparent",
      )}
    >
      <div className="mx-auto flex h-16 w-full max-w-[1400px] items-center gap-6 px-5 sm:px-8">
        <Logo />

        <nav className="ml-6 hidden items-center gap-1 lg:flex" aria-label="Primary">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-md px-3 py-1.5 text-[13.5px] font-medium text-muted-foreground transition-colors duration-150 hover:bg-muted/60 hover:text-foreground"
            >
              {l.label}
            </Link>
          ))}
          <a
            href={REPO_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-[13.5px] font-medium text-muted-foreground transition-colors duration-150 hover:bg-muted/60 hover:text-foreground"
          >
            GitHub <ArrowUpRight className="size-3.5" />
          </a>
        </nav>

        <div className="ml-auto hidden items-center gap-2 lg:flex">
          <Button asChild variant="ghost" size="sm">
            <Link href="/runs">Sign in to console</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/runs#new-run">
              Start a run <ArrowUpRight />
            </Link>
          </Button>
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="site-menu"
          aria-label={open ? "Close menu" : "Open menu"}
          className="ml-auto grid size-9 place-items-center rounded-md border border-border text-foreground transition-colors duration-150 hover:bg-muted lg:hidden"
        >
          {open ? <X className="size-4" /> : <Menu className="size-4" />}
        </button>
      </div>

      <div
        id="site-menu"
        className={cn(
          "grid overflow-hidden transition-[grid-template-rows] duration-200 ease-out lg:hidden",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="min-h-0">
          <nav className="mx-auto flex w-full max-w-[1400px] flex-col gap-1 px-5 pt-1 pb-5 sm:px-8" aria-label="Mobile">
            {LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-2.5 text-[15px] font-medium text-foreground transition-colors duration-150 hover:bg-muted/60"
              >
                {l.label}
              </Link>
            ))}
            <a
              href={REPO_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-md px-3 py-2.5 text-[15px] font-medium text-foreground transition-colors duration-150 hover:bg-muted/60"
            >
              GitHub <ArrowUpRight className="size-4" />
            </a>
            <div className="mt-3 flex gap-2 border-t border-border pt-4">
              <Button asChild variant="outline" className="flex-1">
                <Link href="/runs">Console</Link>
              </Button>
              <Button asChild className="flex-1">
                <Link href="/runs#new-run">Start a run</Link>
              </Button>
            </div>
          </nav>
        </div>
      </div>
    </header>
  );
}
