import { Bug, Film, FileSearch, FlaskConical, Receipt, ShieldCheck, type LucideIcon } from "lucide-react";
import { FindingStatusChip, OutcomeChip, SeverityBadge } from "@/components/chips";
import { Reveal } from "./motion";
import { ScrollHighlight } from "./scroll-highlight";

const REPRO = [
  "Reset environment and go to / as a guest",
  "Click button “Add Canvas Tote Bag to cart”",
  "Click link “Cart (1)”",
  "Click button “Increase quantity for Canvas Tote Bag” twice (header shows Cart (3))",
  "Observe Line total $18.50, Subtotal $18.50, Shipping $5.99, Total $24.49",
];

const SHOTS = [
  { src: "/landing/shots/cart1.jpg", label: "s0215 · Cart (1)" },
  { src: "/landing/shots/cart2.jpg", label: "s0216 · quantity 2, $37.00" },
  { src: "/landing/shots/cart3.jpg", label: "s0217 · quantity 3, $18.50" },
  { src: "/landing/shots/cart3-reload.jpg", label: "s0218 · after reload" },
];

const FEATURES: { icon: LucideIcon; title: string; text: string }[] = [
  {
    icon: ShieldCheck,
    title: "Independent verification",
    text: "A different agent, a new browser context and a freshly reset tenant. Candidates that do not reproduce are marked inconclusive, not reported.",
  },
  {
    icon: Bug,
    title: "Grounded expectations",
    text: "Expected behaviour comes from your product notes, an explicit UI contract such as a “Saved” message, or a programmatic signal like a 404.",
  },
  {
    icon: Film,
    title: "Evidence you can replay",
    text: "Screenshot sequence, a video of the verification session and a Playwright trace you can open in the trace viewer.",
  },
  {
    icon: FlaskConical,
    title: "Standard tests",
    text: "Plain @playwright/test specs with getByRole locators taken from the action log. No YAML, no vendor runner, no lock-in.",
  },
  {
    icon: Receipt,
    title: "Transparent economics",
    text: "Tokens and cost per agent stream to the dashboard as they happen. You always know what a run cost and where the time went.",
  },
  {
    icon: FileSearch,
    title: "Honest reports",
    text: "The final report lists coverage, what was not tested and known limitations, next to the findings table.",
  },
];

export function Evidence() {
  return (
    <section id="evidence" className="border-b border-border">
      {/* Statement */}
      <div className="mx-auto w-full max-w-[1400px] px-5 pt-28 pb-16 sm:px-8">
        <Reveal>
          <p className="eyebrow">Why it is different</p>
        </Reveal>
        <ScrollHighlight
          className="mt-5 max-w-4xl text-[28px] leading-[1.25] font-medium tracking-[-0.03em] sm:text-[40px] lg:text-[48px]"
          text="Writing code is no longer the bottleneck. Proving it works is. Most AI testers report whatever one agent saw once. AppPilot treats that as a rumour: a second agent has to reproduce it from a clean state before you ever hear about it."
        />
      </div>

      {/* Real finding */}
      <div className="mx-auto grid w-full max-w-[1400px] gap-10 px-5 pb-24 sm:px-8 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-16 [&>*]:min-w-0">
        <Reveal className="surface overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 border-b border-border px-5 py-3">
            <span className="eyebrow">F001</span>
            <SeverityBadge severity="critical" />
            <FindingStatusChip status="confirmed" />
            <OutcomeChip outcome="reproduced" />
            <span className="eyebrow ml-auto normal-case tracking-normal">run_6b4c9ec9 · feature: cart</span>
          </div>
          <div className="p-5">
            <h3 className="text-[18px] font-semibold tracking-[-0.02em] text-balance">
              Cart line total shows only the unit price at quantity 3 ($18.50 instead of $55.50), which makes the subtotal, shipping and total wrong
            </h3>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="rounded-md border border-border bg-background p-4">
                <p className="eyebrow">Expected</p>
                <p className="mt-2 text-[13.5px] leading-6 text-foreground/90">
                  Per product notes: line total = unit price × quantity. Canvas Tote Bag × 3 → line total $55.50, subtotal $55.50, shipping Free,
                  total $55.50.
                </p>
              </div>
              <div className="rounded-md border border-danger/30 bg-background p-4">
                <p className="eyebrow text-danger">Actual</p>
                <p className="mt-2 text-[13.5px] leading-6 text-foreground/90">
                  At quantity 3, line total $18.50, subtotal $18.50, shipping $5.99, total $24.49. Quantities 1 and 2 are correct. The wrong values
                  survive a reload.
                </p>
              </div>
            </div>
            <p className="eyebrow mt-6">Reproduction steps</p>
            <ol className="mt-2 flex flex-col divide-y divide-border border-y border-border">
              {REPRO.map((s, i) => (
                <li key={s} className="flex gap-4 py-2.5 text-[13.5px] leading-6">
                  <span className="num w-5 shrink-0 text-muted-foreground">{i + 1}</span>
                  <span>{s}</span>
                </li>
              ))}
            </ol>
            <p className="eyebrow mt-6">Evidence · verify-1</p>
            <ul className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {SHOTS.map((s) => (
                <li key={s.src} className="group overflow-hidden rounded-md border border-border bg-white">
                  <img
                    src={s.src}
                    alt={s.label}
                    draggable={false}
                    className="aspect-[16/10] w-full object-cover object-top transition-transform duration-200 group-hover:scale-[1.03]"
                  />
                  <p className="truncate border-t border-border bg-card px-2 py-1 font-mono text-[10px] text-muted-foreground">{s.label}</p>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex flex-wrap gap-2">
              <Tag>video · verify-1.g1.webm</Tag>
              <Tag>trace.zip · Playwright trace viewer</Tag>
              <Tag>test · F001.spec.ts</Tag>
            </div>
          </div>
        </Reveal>

        <div className="flex flex-col justify-center">
          <Reveal>
            <p className="eyebrow">Bug reports that stand up</p>
            <h2 className="heading mt-3 text-[30px] leading-[1.1] sm:text-[36px]">Every finding is a case file, not an alert.</h2>
            <p className="mt-4 text-[15.5px] leading-7 text-muted-foreground">
              This is a real finding from a real run, unedited. Expected versus actual is grounded in the product notes, the steps name elements
              by accessible role, and the evidence is the verifier’s own session.
            </p>
          </Reveal>
          <ul className="mt-10 grid gap-x-8 gap-y-7 sm:grid-cols-2">
            {FEATURES.map((f, i) => (
              <Reveal as="li" key={f.title} delay={i * 60} className="group flex flex-col gap-3">
                <span className="grid size-9 place-items-center rounded-md border border-border bg-card text-foreground transition-colors duration-200 group-hover:border-signal/50 group-hover:text-signal">
                  <f.icon className="size-[18px]" strokeWidth={1.5} />
                </span>
                <h3 className="text-[15px] font-semibold tracking-[-0.01em]">{f.title}</h3>
                <p className="text-[13.5px] leading-6 text-muted-foreground">{f.text}</p>
              </Reveal>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex h-7 items-center rounded-md border border-border px-2 font-mono text-[11px] text-muted-foreground">{children}</span>;
}
