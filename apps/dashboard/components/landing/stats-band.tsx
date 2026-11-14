import { CountUp, Reveal } from "./motion";

/** Numbers from rehearsal run 2 (run_6b4c9ec9): broad prompt, product notes attached, parallel explorers. */
const STATS = [
  { value: 3, suffix: " / 3", label: "Seeded bugs found and confirmed", note: "no duplicates, no misses" },
  { value: 0, label: "False positives reported", note: "one extra candidate marked inconclusive" },
  { value: 10.7, decimals: 1, suffix: " min", label: "Full run, wall clock", note: "plan → explore → verify → tests" },
  { value: 4.81, decimals: 2, prefix: "$", label: "Cost of the run", note: "6.5M input tokens, mostly cache reads" },
  { value: 262, label: "Screenshots captured", note: "plus video and a Playwright trace per verification" },
  { value: 3, suffix: " / 3", label: "Tests that reproduce the bug", note: "each fails on an expect(), never a timeout" },
];

export function StatsBand() {
  return (
    <section className="border-b border-border bg-card/30">
      <div className="mx-auto w-full max-w-[1400px] px-5 py-14 sm:px-8">
        <Reveal className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <p className="eyebrow">Measured on a seeded-bug storefront · rehearsal run 2</p>
          <p className="text-xs text-muted-foreground">Three planted bugs, one documented decoy, no hints about where they were.</p>
        </Reveal>
        <dl className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border md:grid-cols-3 xl:grid-cols-6">
          {STATS.map((s, i) => (
            <Reveal key={s.label} delay={i * 60} className="flex flex-col gap-2 bg-background p-5 sm:p-6">
              <dd className="text-[30px] leading-none font-medium tracking-[-0.03em] text-foreground sm:text-[34px]">
                <CountUp value={s.value} decimals={s.decimals} prefix={s.prefix} suffix={s.suffix} />
              </dd>
              <dt className="text-[13px] font-medium text-foreground/90">{s.label}</dt>
              <p className="text-xs leading-5 text-muted-foreground">{s.note}</p>
            </Reveal>
          ))}
        </dl>
      </div>
    </section>
  );
}
