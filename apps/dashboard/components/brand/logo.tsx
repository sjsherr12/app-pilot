import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Placeholder brand mark. Replace by editing this SVG (or swapping in the real
 * geometry from public/brand/mark-chalk.svg). Uses currentColor so it inherits text color.
 */
export function Mark({ className, title = "AppPilot" }: { className?: string; title?: string }) {
  return (
    <svg viewBox="0 0 48 40" fill="currentColor" role="img" aria-label={title} className={cn("block", className)}>
      <polygon points="0,40 12,40 30,0 18,0" />
      <polygon points="20,40 48,40 48,14" />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return <span className={cn("font-semibold tracking-[-0.03em]", className)}>AppPilot</span>;
}

export function Logo({ className, markClassName, href = "/" }: { className?: string; markClassName?: string; href?: string | null }) {
  const inner = (
    <>
      <Mark className={cn("h-[18px] w-auto text-foreground", markClassName)} />
      <Wordmark className="text-[17px] leading-none" />
    </>
  );
  const classes = cn("inline-flex items-center gap-2.5 text-foreground", className);
  if (!href) return <span className={classes}>{inner}</span>;
  return (
    <Link href={href} className={classes} aria-label="AppPilot home">
      {inner}
    </Link>
  );
}
