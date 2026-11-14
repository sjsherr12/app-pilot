import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Brand assets live in public/brand (see public/brand/README.md). The components below render those files
 * directly, so replacing a file changes the UI with no code edits.
 *
 * - mark-chalk.svg / mark-ink.svg / mark-signal.svg: the mark alone (viewBox 778×443)
 * - wordmark-chalk.svg: mark + outlined "AppPilot" lockup (viewBox 1066×222)
 */
export type MarkVariant = "chalk" | "ink" | "signal";

export function Mark({ variant = "chalk", className, title }: { variant?: MarkVariant; className?: string; title?: string }) {
  return (
    <img
      src={`/brand/mark-${variant}.svg`}
      alt={title ?? ""}
      aria-hidden={title ? undefined : true}
      draggable={false}
      className={cn("block h-5 w-auto select-none", className)}
    />
  );
}

/** The full lockup (mark + "AppPilot") from public/brand/wordmark-chalk.svg. */
export function Lockup({ className, title = "AppPilot" }: { className?: string; title?: string }) {
  return (
    <img src="/brand/wordmark-chalk.svg" alt={title} draggable={false} className={cn("block h-[22px] w-auto select-none", className)} />
  );
}

/** Text wordmark in Geist, for places where the SVG lockup is too small to read. */
export function Wordmark({ className }: { className?: string }) {
  return <span className={cn("font-semibold tracking-[-0.03em]", className)}>AppPilot</span>;
}

export function Logo({ className, href = "/" }: { className?: string; href?: string | null }) {
  const classes = cn("inline-flex items-center text-foreground", className);
  if (!href) {
    return (
      <span className={classes}>
        <Lockup />
      </span>
    );
  }
  return (
    <Link href={href} className={classes} aria-label="AppPilot home">
      <Lockup />
    </Link>
  );
}
