"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Radar } from "lucide-react";
import { cn } from "@/lib/utils";
import { MOCK, API_BASE } from "@/lib/api";

export function TopNav() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-30 border-b border-border/70 bg-background/80 backdrop-blur supports-backdrop-filter:bg-background/60">
      <div className="mx-auto flex h-12 w-full max-w-[1800px] items-center gap-4 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="grid size-7 place-items-center rounded-lg bg-linear-to-br from-sky-400 to-violet-500 text-white shadow-[0_0_24px_-4px_oklch(0.7_0.15_260)]">
            <Radar className="size-4" />
          </span>
          <span>AppPilot</span>
          <span className="hidden text-xs font-normal text-muted-foreground sm:inline">
            autonomous QA engineer
          </span>
        </Link>
        <nav className="ml-4 flex items-center gap-1 text-sm">
          <Link
            href="/"
            className={cn(
              "rounded-md px-2.5 py-1 text-muted-foreground transition-colors hover:text-foreground",
              pathname === "/" && "bg-muted text-foreground",
            )}
          >
            Runs
          </Link>
        </nav>
        <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
          {MOCK ? (
            <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 font-medium text-amber-300">
              Mock data
            </span>
          ) : (
            <span className="hidden font-mono sm:inline" title="API base">
              {API_BASE}
            </span>
          )}
        </div>
      </div>
    </header>
  );
}
