"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { MOCK, API_BASE } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/brand/logo";

const NAV = [{ href: "/runs", label: "Runs" }];

export function TopNav() {
  const pathname = usePathname();
  const onLanding = pathname === "/";
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur-sm">
      <div className="mx-auto flex h-14 w-full max-w-[1800px] items-center gap-8 px-5 sm:px-8">
        <Logo />
        <nav className="flex items-center gap-1 text-sm" aria-label="Primary">
          {NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "relative rounded-md px-2.5 py-1.5 font-medium text-muted-foreground transition-colors duration-150 hover:text-foreground",
                  active && "text-foreground",
                )}
              >
                {item.label}
                {active ? <span className="absolute inset-x-2.5 -bottom-[13px] h-0.5 bg-primary" /> : null}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-3">
          {MOCK ? (
            <span className="inline-flex h-6 items-center rounded-full border border-warn/40 px-2 font-mono text-[11px] font-medium text-warn">
              Mock data
            </span>
          ) : (
            <span className="eyebrow hidden md:inline" title="API base">
              {API_BASE.replace(/^https?:\/\//, "")}
            </span>
          )}
          {onLanding ? (
            <Button asChild size="sm">
              <Link href="/runs">
                Open console <ArrowUpRight />
              </Link>
            </Button>
          ) : null}
        </div>
      </div>
    </header>
  );
}
