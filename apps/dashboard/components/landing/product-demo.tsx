"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Coins, Globe, LoaderCircle, Timer, CircleCheckBig, FlaskConical, RotateCcw } from "lucide-react";
import type { AgentName, RunStatus } from "@/lib/api";
import { formatDuration, formatUsd } from "@/lib/format";
import { cn } from "@/lib/utils";
import { AgentBadge, FindingStatusChip, RunStatusChip, SeverityBadge, TestStatusChip } from "@/components/chips";

/**
 * A scripted replay of a real AppPilot run (run_6b4c9ec9 against the Northstar Goods demo shop).
 * Every screenshot is a real capture from that run; the timeline is compressed from 10.7 minutes to ~30 seconds.
 * The whole frame is derived from one clock value, so it stays deterministic and cheap to render.
 */

type ShotKey = "home" | "added" | "cart1" | "cart2" | "cart3" | "cart3-reload" | "blank";

const SHOT_SRC: Record<Exclude<ShotKey, "blank">, string> = {
  home: "/landing/shots/home.jpg",
  added: "/landing/shots/added.jpg",
  cart1: "/landing/shots/cart1.jpg",
  cart2: "/landing/shots/cart2.jpg",
  cart3: "/landing/shots/cart3.jpg",
  "cart3-reload": "/landing/shots/cart3-reload.jpg",
};

interface Step {
  at: number;
  agent: AgentName;
  tool: string;
  text: string;
  session?: "explore-1" | "verify-1";
  shot?: ShotKey;
  url?: string;
  finding?: "candidate" | "confirmed";
  test?: "saved" | "reproduces";
  status?: "completed";
}

const SCRIPT: Step[] = [
  { at: 0, agent: "supervisor", tool: "write_todos", text: "Plan by risk: cart arithmetic, persistence, order navigation" },
  { at: 1500, agent: "supervisor", tool: "task", text: "explorer · “Exercise the cart: quantities, totals, shipping threshold”" },
  { at: 2800, agent: "explorer", tool: "navigate", text: "/", session: "explore-1", shot: "home", url: "localhost:3001/" },
  { at: 4300, agent: "explorer", tool: "click", text: "button “Add Canvas Tote Bag to cart”", shot: "added" },
  { at: 5800, agent: "explorer", tool: "click", text: "link “Cart (1)”", shot: "cart1", url: "localhost:3001/cart" },
  { at: 7300, agent: "explorer", tool: "click", text: "button “Increase quantity for Canvas Tote Bag”", shot: "cart2" },
  { at: 8800, agent: "explorer", tool: "click", text: "button “Increase quantity for Canvas Tote Bag”", shot: "cart3" },
  { at: 10400, agent: "explorer", tool: "record_candidate_finding", text: "F001 · line total $18.50 at quantity 3, expected $55.50", finding: "candidate" },
  { at: 12000, agent: "supervisor", tool: "task", text: "verifier · “Reproduce F001 from a clean state”" },
  { at: 13300, agent: "verifier", tool: "reset_environment", text: "tenant verify-1 reset · new browser context · cookies cleared", session: "verify-1", shot: "blank", url: "about:blank" },
  { at: 14700, agent: "verifier", tool: "navigate", text: "/", shot: "home", url: "localhost:3001/" },
  { at: 15800, agent: "verifier", tool: "click", text: "button “Add Canvas Tote Bag to cart”", shot: "added" },
  { at: 16900, agent: "verifier", tool: "click", text: "link “Cart (1)”", shot: "cart1", url: "localhost:3001/cart" },
  { at: 18000, agent: "verifier", tool: "click", text: "button “Increase quantity for Canvas Tote Bag” ×2", shot: "cart3" },
  { at: 19300, agent: "verifier", tool: "reload", text: "/cart · wrong totals survive a reload", shot: "cart3-reload" },
  { at: 20800, agent: "verifier", tool: "update_finding", text: "F001 → confirmed · reproduced 1/1 · video and trace saved", finding: "confirmed" },
  { at: 22400, agent: "supervisor", tool: "task", text: "test_writer · “Cover F001 with a regression test”" },
  { at: 23700, agent: "test_writer", tool: "save_regression_test", text: "tests/F001.spec.ts · getByRole locators from the action log", test: "saved" },
  { at: 25300, agent: "test_writer", tool: "run_regression_test", text: "failed on expect(): $24.49 should not appear, received 1", test: "reproduces" },
  { at: 27200, agent: "supervisor", tool: "finalize_run", text: "3 confirmed · 0 false positives · report written", status: "completed" },
];

const LOOP_MS = 31_500;
const END_MS = SCRIPT[SCRIPT.length - 1].at;
/** Compress the real 10.7 min run into the scripted window. */
const CLOCK_SCALE = (10.7 * 60_000) / END_MS;
const FINAL_COST = 4.81;

function useDemoClock(active: boolean, reduced: boolean) {
  const [t, setT] = useState(0);
  /** Where the clock stood when it last paused, so scrolling away and back resumes rather than restarts. */
  const offsetRef = useRef(0);
  const lastBucket = useRef(-1);

  useEffect(() => {
    if (reduced) {
      const id = requestAnimationFrame(() => setT(END_MS));
      return () => cancelAnimationFrame(id);
    }
    if (!active) return;
    let raf = 0;
    let start: number | null = null;
    const tick = (now: number) => {
      if (start == null) start = now - offsetRef.current;
      const elapsed = (now - start) % LOOP_MS;
      offsetRef.current = elapsed;
      const bucket = Math.floor(elapsed / 80);
      if (bucket !== lastBucket.current) {
        lastBucket.current = bucket;
        setT(elapsed);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, reduced]);

  return t;
}

export function ProductDemo({ className }: { className?: string }) {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const [active, setActive] = useState(false);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduced(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setActive(e.isIntersecting), { threshold: 0.2 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const t = useDemoClock(active, reduced);

  const view = useMemo(() => {
    const done = SCRIPT.filter((s) => s.at <= t);
    const last = <K extends keyof Step>(key: K) => [...done].reverse().find((s) => s[key] !== undefined)?.[key];
    return {
      feed: done.slice(-7),
      shot: (last("shot") as ShotKey | undefined) ?? "blank",
      session: (last("session") as Step["session"]) ?? "explore-1",
      url: (last("url") as string | undefined) ?? "about:blank",
      finding: last("finding") as Step["finding"],
      test: last("test") as Step["test"],
      status: ((last("status") as Step["status"]) ?? "running") as RunStatus,
      elapsed: Math.min(t, END_MS) * CLOCK_SCALE,
      cost: FINAL_COST * Math.min(1, t / END_MS),
      progress: Math.min(1, t / END_MS),
      restarting: t > END_MS + 2500,
    };
  }, [t]);

  return (
    <div
      ref={frameRef}
      className={cn("surface relative overflow-hidden text-left shadow-[0_30px_80px_-40px_rgba(0,0,0,0.8)]", className)}
      aria-label="Replay of an AppPilot run"
      role="img"
    >
      {/* Progress hairline */}
      <div className="absolute inset-x-0 top-0 h-px bg-border">
        <div
          className="h-full origin-left bg-signal transition-transform duration-100 ease-linear"
          style={{ transform: `scaleX(${view.progress})` }}
        />
      </div>

      {/* Header */}
      <div className="flex h-12 items-center gap-3 border-b border-border px-4">
        <span className="text-[13px] font-medium">Run</span>
        <span className="eyebrow normal-case tracking-normal">run_6b4c9ec9</span>
        <span className="hidden text-[13px] text-muted-foreground sm:inline">· Test this application and find any broken functionality.</span>
        <div className="ml-auto flex items-center gap-2">
          <HeaderStat icon={<Timer />} value={formatDuration(view.elapsed)} />
          <HeaderStat icon={<Coins />} value={formatUsd(view.cost)} className="hidden sm:inline-flex" />
          <RunStatusChip status={view.status} />
        </div>
      </div>

      {/* Body */}
      <div className="grid md:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] [&>*]:min-w-0">
        {/* Browser */}
        <div className="flex flex-col border-b border-border md:border-r md:border-b-0">
          <div className="flex h-10 items-center gap-1 border-b border-border px-2">
            <SessionTab label="explore-1" active={view.session === "explore-1"} live={view.session === "explore-1" && view.status === "running"} />
            <SessionTab label="verify-1" active={view.session === "verify-1"} live={view.session === "verify-1" && view.status === "running"} muted={t < 13300} />
            <div className="ml-auto flex h-7 min-w-0 max-w-[55%] items-center gap-1.5 rounded-md border border-border bg-background px-2 font-mono text-[11px] text-muted-foreground">
              <Globe className="size-3 shrink-0" />
              <span className="truncate">{view.url}</span>
            </div>
          </div>
          <div className="relative aspect-[16/10] w-full overflow-hidden bg-[#f8fafc]">
            {(Object.keys(SHOT_SRC) as Array<keyof typeof SHOT_SRC>).map((key) => (
              <img
                key={key}
                src={SHOT_SRC[key]}
                alt=""
                draggable={false}
                className={cn(
                  "absolute inset-0 h-full w-full object-cover object-top transition-opacity duration-200",
                  view.shot === key ? "opacity-100" : "opacity-0",
                )}
              />
            ))}
            <div
              className={cn(
                "absolute inset-0 grid place-items-center bg-background transition-opacity duration-200",
                view.shot === "blank" ? "opacity-100" : "pointer-events-none opacity-0",
              )}
            >
              <div className="flex flex-col items-center gap-2 text-center">
                <RotateCcw className="size-5 text-muted-foreground" strokeWidth={1.5} />
                <p className="text-sm font-medium">Fresh browser context</p>
                <p className="eyebrow">tenant verify-1 · storage cleared</p>
              </div>
            </div>
            {/* Callout on the bug */}
            <div
              className={cn(
                "absolute right-[3%] top-[26.5%] rounded-md border border-danger/70 px-1.5 py-0.5 font-mono text-[10px] text-danger transition-opacity duration-200",
                view.shot === "cart3" || view.shot === "cart3-reload" ? "opacity-100" : "opacity-0",
              )}
              style={{ background: "color-mix(in srgb, var(--danger) 8%, white)" }}
            >
              expected $55.50
            </div>
          </div>
        </div>

        {/* Feed + findings + tests */}
        <div className="flex min-h-0 flex-col">
          <div className="flex h-10 items-center gap-2 border-b border-border px-4">
            <span className="text-[13px] font-medium">Agents</span>
            <span className="eyebrow">supervisor · explorer · verifier · test_writer</span>
          </div>
          <ol className="flex flex-1 flex-col justify-end gap-1 overflow-hidden px-3 py-3" aria-live="off">
            {view.feed.map((s) => (
              <li key={s.at} className="rise-in flex items-start gap-2 rounded-md px-1 py-1">
                <AgentBadge agent={s.agent} className="mt-px" />
                <div className="min-w-0 flex-1">
                  <span className="font-mono text-[11px] text-foreground/80">{s.tool}</span>
                  <p className="truncate text-[12.5px] leading-5 text-muted-foreground">{s.text}</p>
                </div>
              </li>
            ))}
            {view.status === "running" ? (
              <li className="flex items-center gap-2 px-1 pt-1">
                <LoaderCircle className="size-3 animate-spin text-signal [animation-duration:1.4s]" />
                <span className="eyebrow text-signal">working</span>
              </li>
            ) : null}
          </ol>

          <div className="grid grid-cols-1 divide-y divide-border border-t border-border">
            <Row label="Findings">
              {view.finding ? (
                <div key={view.finding} className="rise-in flex min-w-0 items-center gap-2">
                  <span className="eyebrow">F001</span>
                  <span className="min-w-0 flex-1 truncate text-[12.5px]">Cart line total ignores quantity at 3+</span>
                  <SeverityBadge severity="critical" className="hidden sm:inline-flex" />
                  <FindingStatusChip status={view.finding} className="chip-pop" />
                </div>
              ) : (
                <Empty>No findings yet</Empty>
              )}
            </Row>
            <Row label="Tests">
              {view.test ? (
                <div key={view.test} className="rise-in flex min-w-0 items-center gap-2">
                  <FlaskConical className="size-3.5 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate font-mono text-[12px]">F001.spec.ts</span>
                  {view.test === "reproduces" ? (
                    <>
                      <span className="inline-flex h-[22px] items-center gap-1 rounded-full border border-signal/40 bg-signal/8 px-2 text-[11px] font-medium text-signal">
                        <CircleCheckBig className="size-3" /> Reproduces bug
                      </span>
                      <TestStatusChip status="failed" className="chip-pop" />
                    </>
                  ) : (
                    <span className="eyebrow inline-flex items-center gap-1.5">
                      <LoaderCircle className="size-3 animate-spin" /> running
                    </span>
                  )}
                </div>
              ) : (
                <Empty>No tests yet</Empty>
              )}
            </Row>
          </div>
        </div>
      </div>

      {/* Loop notice */}
      <div
        className={cn(
          "pointer-events-none absolute inset-x-0 bottom-0 flex justify-center pb-3 transition-opacity duration-200",
          view.restarting ? "opacity-100" : "opacity-0",
        )}
      >
        <span className="eyebrow rounded-full border border-border bg-background/90 px-2.5 py-1 backdrop-blur-sm">Replaying…</span>
      </div>
    </div>
  );
}

function HeaderStat({ icon, value, className }: { icon: React.ReactNode; value: string; className?: string }) {
  return (
    <span className={cn("num inline-flex h-7 items-center gap-1.5 rounded-md border border-border bg-background px-2 text-[12px] [&_svg]:size-3 [&_svg]:text-muted-foreground", className)}>
      {icon}
      {value}
    </span>
  );
}

function SessionTab({ label, active, live, muted }: { label: string; active: boolean; live: boolean; muted?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-md px-2 font-mono text-[11px] transition-colors duration-150",
        active ? "bg-muted text-foreground" : "text-muted-foreground",
        muted && "opacity-40",
      )}
    >
      <span className={cn("size-1.5 rounded-full", live ? "pulse-dot bg-signal" : "bg-slate")} />
      {label}
    </span>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex h-12 items-center gap-3 px-4">
      <span className="eyebrow w-14 shrink-0">{label}</span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <span className="text-[12px] text-muted-foreground/70">{children}</span>;
}
