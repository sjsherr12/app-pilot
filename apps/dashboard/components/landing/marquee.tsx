const ITEMS = [
  "Playwright",
  "@playwright/test specs",
  "getByRole locators",
  "GitHub Actions",
  "Pull request export",
  "Chromium",
  "Next.js · React · any web app",
  "Claude Opus 5.5",
  "LangSmith traces",
  "Video + trace per verification",
  "Per-tenant resets",
  "Live SSE event stream",
];

/** A quiet, continuous strip of what AppPilot is built on and emits. Pauses on hover. */
export function Marquee() {
  const row = [...ITEMS, ...ITEMS];
  return (
    <div className="marquee relative overflow-hidden border-b border-border py-4" aria-label="Built on">
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-gradient-to-r from-background to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-gradient-to-l from-background to-transparent" />
      <ul className="marquee-track flex w-max items-center gap-3 pr-3" style={{ "--marquee-duration": "48s" } as React.CSSProperties}>
        {row.map((item, i) => (
          <li
            key={`${item}-${i}`}
            aria-hidden={i >= ITEMS.length}
            className="inline-flex h-8 shrink-0 items-center gap-2 rounded-full border border-border px-3 font-mono text-[11.5px] text-muted-foreground"
          >
            <span className="size-1 rounded-full bg-signal/70" />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
