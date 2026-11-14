"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Check, Circle, CircleCheck, GitPullRequest, LoaderCircle, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { AgentBadge, FindingStatusChip, OutcomeChip, SeverityBadge } from "@/components/chips";
import { Reveal } from "./motion";

const STEPS = [
  {
    n: "01",
    title: "Plan",
    lead: "A supervisor reads your objective and product notes, then plans by risk.",
    body: "Money, persistence and navigation go first. The plan is a live todo list you can watch change, and every later decision traces back to it.",
  },
  {
    n: "02",
    title: "Explore",
    lead: "Explorers drive a real browser through every flow and the edge cases around it.",
    body: "Each action is recorded by accessible role and name, with a screenshot, console errors and failed requests. Suspected bugs are filed as candidates, never as bugs.",
  },
  {
    n: "03",
    title: "Verify",
    lead: "A separate verifier reproduces each candidate from a clean slate.",
    body: "New browser context, cookies gone, server-side tenant reset. It follows the repro steps to the letter and records video and a Playwright trace. Only what reproduces is confirmed.",
  },
  {
    n: "04",
    title: "Prove",
    lead: "Every confirmed bug ships with a standard Playwright test and an optional pull request.",
    body: "The spec fails on an expect() that states the bug, passes once it is fixed, and runs in any CI. One click opens a PR with the bug report as its body.",
  },
];

export function HowItWorks() {
  const [active, setActive] = useState(0);
  const refs = useRef<Array<HTMLLIElement | null>>([]);

  useEffect(() => {
    const els = refs.current.filter(Boolean) as HTMLLIElement[];
    if (els.length === 0) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.index));
        }
      },
      { rootMargin: "-45% 0px -45% 0px", threshold: 0 },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <section id="how-it-works" className="border-b border-border">
      <div className="mx-auto w-full max-w-[1400px] px-5 py-24 sm:px-8">
        <Reveal className="max-w-2xl">
          <p className="eyebrow">How it works</p>
          <h2 className="heading mt-3 text-[32px] leading-[1.1] sm:text-[40px]">Plan. Explore. Verify. Prove.</h2>
          <p className="mt-4 text-[16px] leading-7 text-muted-foreground">
            Four specialised agents, one rule: nothing is reported until it has been reproduced from a clean state.
          </p>
        </Reveal>

        <div className="mt-16 grid gap-12 lg:grid-cols-2 lg:gap-16 [&>*]:min-w-0">
          {/* Sticky visual (desktop) */}
          <div className="hidden lg:block">
            <div className="sticky top-28">
              <div className="surface relative h-[560px] overflow-hidden">
                {STEPS.map((s, i) => (
                  <div
                    key={s.n}
                    className={cn(
                      "absolute inset-0 p-6 transition-all duration-300 ease-out",
                      active === i ? "translate-y-0 opacity-100" : i < active ? "-translate-y-3 opacity-0" : "translate-y-3 opacity-0",
                    )}
                    aria-hidden={active !== i}
                  >
                    <Visual index={i} active={active === i} />
                  </div>
                ))}
              </div>
              <div className="mt-4 flex items-center gap-2">
                {STEPS.map((s, i) => (
                  <span key={s.n} className={cn("h-0.5 flex-1 rounded-full transition-colors duration-200", i <= active ? "bg-signal" : "bg-border")} />
                ))}
              </div>
            </div>
          </div>

          {/* Steps */}
          <ol className="flex min-w-0 flex-col gap-14 lg:gap-0">
            {STEPS.map((s, i) => (
              <li
                key={s.n}
                data-index={i}
                ref={(el) => {
                  refs.current[i] = el;
                }}
                className="flex min-w-0 flex-col gap-6 lg:min-h-[62vh] lg:justify-center"
              >
                <Reveal>
                  <div className="flex items-center gap-3">
                    <span className={cn("eyebrow transition-colors duration-200", active === i && "text-signal")}>{s.n}</span>
                    <span className="h-px flex-1 bg-border" />
                  </div>
                  <h3 className="mt-4 text-[26px] font-semibold tracking-[-0.03em] sm:text-[30px]">{s.title}</h3>
                  <p className="mt-3 text-[17px] leading-7 text-foreground/90">{s.lead}</p>
                  <p className="mt-3 max-w-lg text-[15px] leading-7 text-muted-foreground">{s.body}</p>
                </Reveal>
                {/* Inline visual on small screens */}
                <Reveal className="surface min-w-0 overflow-hidden p-5 lg:hidden" delay={80}>
                  <Visual index={i} active />
                </Reveal>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

function Visual({ index, active }: { index: number; active: boolean }) {
  switch (index) {
    case 0:
      return <PlanVisual active={active} />;
    case 1:
      return <ExploreVisual active={active} />;
    case 2:
      return <VerifyVisual active={active} />;
    default:
      return <ProveVisual active={active} />;
  }
}

/** Restarts child entrance animations each time the panel becomes active. */
function Stagger({ active, children }: { active: boolean; children: React.ReactNode }) {
  return <div key={active ? "on" : "off"}>{children}</div>;
}

const d = (ms: number) => ({ "--d": `${ms}ms` }) as CSSProperties;

function PlanVisual({ active }: { active: boolean }) {
  const todos = [
    { t: "Cart arithmetic: line totals, subtotal, shipping threshold", s: "done" },
    { t: "Checkout and order confirmation links", s: "done" },
    { t: "Account: display name and preferences persist", s: "running" },
    { t: "Coupon rules against product notes (WELCOME10)", s: "queued" },
    { t: "Verify every candidate in a fresh context", s: "queued" },
  ] as const;
  return (
    <Stagger active={active}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AgentBadge agent="supervisor" />
          <span className="font-mono text-[11px] text-foreground/80">write_todos</span>
        </div>
        <span className="eyebrow">ordered by risk</span>
      </div>
      <ol className="mt-6 flex flex-col gap-2">
        {todos.map((td, i) => (
          <li key={td.t} className="rise-in flex items-center gap-3 rounded-md border border-border bg-background px-3 py-2.5" style={d(80 + i * 90)}>
            {td.s === "done" ? (
              <CircleCheck className="size-4 text-signal" />
            ) : td.s === "running" ? (
              <LoaderCircle className="size-4 animate-spin text-signal [animation-duration:1.4s]" />
            ) : (
              <Circle className="size-4 text-muted-foreground" />
            )}
            <span className={cn("text-[13px]", td.s === "queued" && "text-muted-foreground")}>{td.t}</span>
            <span className="eyebrow ml-auto">{td.s === "done" ? "Complete" : td.s === "running" ? "Running" : "Queued"}</span>
          </li>
        ))}
      </ol>
      <p className="mt-5 text-xs leading-5 text-muted-foreground">
        Objective: “Test this application and find any broken functionality.” Product notes attached, so documented behaviour is never
        mistaken for a bug.
      </p>
    </Stagger>
  );
}

function ExploreVisual({ active }: { active: boolean }) {
  const refs = [
    { id: "e12", role: "button", name: "Increase quantity for Canvas Tote Bag", left: "37.6%", top: "27.8%", w: "4%", h: "5.8%", pulse: true },
    { id: "e18", role: "text", name: "Total $24.49", left: "82.4%", top: "30.7%", w: "6.4%", h: "5.1%" },
    { id: "e05", role: "link", name: "Cart (3)", left: "68.6%", top: "1.8%", w: "4.4%", h: "4%" },
  ];
  return (
    <Stagger active={active}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AgentBadge agent="explorer" />
          <span className="font-mono text-[11px] text-foreground/80">snapshot</span>
        </div>
        <span className="eyebrow">refs by role + name</span>
      </div>
      <div className="relative mt-5 aspect-[16/9] overflow-hidden rounded-md border border-border bg-white">
        <img src="/landing/shots/cart3.jpg" alt="" className="block h-full w-full object-cover object-top" draggable={false} />
        {refs.map((r, i) => (
          <div key={r.id} className="rise-in absolute" style={{ left: r.left, top: r.top, width: r.w, height: r.h, ...d(200 + i * 160) }}>
            <span className={cn("block h-full w-full rounded-[3px] border border-signal", r.pulse && "ref-pulse")} />
            <span className="absolute -top-5 left-0 hidden whitespace-nowrap rounded-[3px] bg-ink px-1 py-0.5 font-mono text-[9.5px] text-signal sm:block">
              [{r.id}] {r.role} “{r.name}”
            </span>
          </div>
        ))}
      </div>
      <ul className="mt-4 flex flex-col gap-1 font-mono text-[11px] text-muted-foreground">
        {["click [e12] → Cart (3) · line total $18.50", "read_text [e18] → $24.49 · expected $55.50", "record_candidate_finding F001"].map((l, i) => (
          <li key={l} className="rise-in" style={d(500 + i * 140)}>
            <span className="text-foreground/70">›</span> {l}
          </li>
        ))}
      </ul>
    </Stagger>
  );
}

function VerifyVisual({ active }: { active: boolean }) {
  const checks = [
    { t: "Reset tenant verify-1", icon: RotateCcw },
    { t: "New browser context, no cookies or storage", icon: Check },
    { t: "Replayed 5 repro steps by role and name", icon: Check },
    { t: "Observed Total $24.49 where $55.50 was expected", icon: Check },
    { t: "Survives reload · video + trace saved", icon: Check },
  ];
  return (
    <Stagger active={active}>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-md border border-border bg-background p-3">
          <div className="flex items-center justify-between">
            <AgentBadge agent="explorer" />
            <FindingStatusChip status="candidate" />
          </div>
          <p className="mt-3 text-[12.5px] leading-5 text-muted-foreground">Saw it once, in session explore-1, mid-exploration.</p>
        </div>
        <div className="rounded-md border border-signal/40 bg-background p-3">
          <div className="flex items-center justify-between">
            <AgentBadge agent="verifier" />
            <span className="eyebrow text-signal">fresh</span>
          </div>
          <p className="mt-3 text-[12.5px] leading-5 text-muted-foreground">Independent session verify-1, clean state, exact steps.</p>
        </div>
      </div>
      <ol className="mt-4 flex flex-col gap-2">
        {checks.map((c, i) => (
          <li key={c.t} className="rise-in flex items-center gap-3 text-[13px]" style={d(150 + i * 140)}>
            <span className="grid size-5 place-items-center rounded-full border border-signal/50 text-signal">
              <c.icon className="size-3" />
            </span>
            {c.t}
          </li>
        ))}
      </ol>
      <div className="rise-in mt-5 flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2.5" style={d(950)}>
        <span className="eyebrow">F001</span>
        <span className="flex-1 truncate text-[13px]">Cart line total ignores quantity at 3+</span>
        <SeverityBadge severity="critical" />
        <OutcomeChip outcome="reproduced" />
        <FindingStatusChip status="confirmed" className="chip-pop" />
      </div>
    </Stagger>
  );
}

function ProveVisual({ active }: { active: boolean }) {
  const lines = [
    ['import { test, expect } from "@playwright/test";', "text-foreground/80"],
    ["", ""],
    ['test("Cart line total equals unit price × quantity", async ({ page }) => {', "text-foreground/80"],
    ['  await page.goto("/");', ""],
    ['  await page.getByRole("button", { name: "Add Canvas Tote Bag to cart" }).click();', ""],
    ['  await page.getByRole("link", { name: "Cart (1)" }).click();', ""],
    ['  const inc = page.getByRole("button", { name: "Increase quantity for Canvas Tote Bag" });', ""],
    ["  await inc.click(); await inc.click();", ""],
    ['  await expect(page.getByText("$24.49", { exact: true })).toHaveCount(0);', "text-signal"],
    ['  await expect(page.getByText("$55.50", { exact: true }).first()).toBeVisible();', "text-signal"],
    ["});", "text-foreground/80"],
  ] as const;
  return (
    <Stagger active={active}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AgentBadge agent="test_writer" />
          <span className="font-mono text-[11px] text-foreground/80">save_regression_test</span>
        </div>
        <span className="eyebrow">tests/F001.spec.ts</span>
      </div>
      <pre className="mt-4 overflow-hidden rounded-md border border-border bg-background p-3 font-mono text-[10.5px] leading-[1.55] text-muted-foreground">
        {lines.map(([l, cls], i) => (
          <div key={i} className={cn("rise-in whitespace-pre", cls)} style={d(60 + i * 55)}>
            {l || " "}
          </div>
        ))}
      </pre>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rise-in rounded-md border border-danger/40 bg-danger/8 px-3 py-2.5" style={d(760)}>
          <p className="eyebrow text-danger">buggy build</p>
          <p className="mt-1 font-mono text-[11.5px] text-danger">✗ 1 failed · expect() · 11.3 s</p>
        </div>
        <div className="rise-in rounded-md border border-signal/40 bg-signal/8 px-3 py-2.5" style={d(900)}>
          <p className="eyebrow text-signal">after the fix</p>
          <p className="mt-1 font-mono text-[11.5px] text-signal">✓ 1 passed · 1.1 s</p>
        </div>
      </div>
      <div className="rise-in mt-3 inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-[12.5px]" style={d(1040)}>
        <GitPullRequest className="size-3.5 text-signal" />
        <span className="font-mono text-[11.5px]">apppilot/F001-6b4c9ec9</span>
        <span className="text-muted-foreground">· PR opened with the bug report as its body</span>
      </div>
    </Stagger>
  );
}
