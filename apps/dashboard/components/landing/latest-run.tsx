"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, CircleCheck, LoaderCircle, Circle } from "lucide-react";
import { getRun, listRuns, type Finding, type Run, type TestCase } from "@/lib/api";
import { formatDuration, formatUsd, truncate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { FindingStatusChip, RunStatusChip } from "@/components/chips";

interface Snapshot {
  run: Run;
  findings: Finding[];
  tests: TestCase[];
  fetchedAt: number;
}

/** The hero card: the most recent real run when the API is reachable, otherwise an example trace. */
export function LatestRun() {
  const [snap, setSnap] = useState<Snapshot | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const runs = await listRuns();
        const sorted = [...runs].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
        const pick = sorted.find((r) => r.status === "running") ?? sorted.find((r) => r.status === "completed") ?? sorted[0];
        if (!pick) {
          if (!cancelled) setSnap(null);
          return;
        }
        const detail = await getRun(pick.id);
        if (!cancelled) setSnap({ run: detail.run, findings: detail.findings, tests: detail.tests, fetchedAt: Date.now() });
      } catch {
        if (!cancelled) setSnap(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (snap === undefined) return <Frame title="Latest run" subtitle="loading…" />;
  if (snap === null) return <ExampleTrace />;

  const { run, findings, tests, fetchedAt } = snap;
  const confirmed = findings.filter((f) => f.status === "confirmed").length;
  const reproducing = tests.filter((t) => t.last_result?.reproduces_bug).length;
  const elapsed = run.started_at ? Math.max(0, (run.finished_at ? Date.parse(run.finished_at) : fetchedAt) - Date.parse(run.started_at)) : null;
  const shown = [...findings].sort((a, b) => a.id.localeCompare(b.id)).slice(0, 4);

  return (
    <Frame
      title={run.status === "running" ? "Live run" : "Latest run"}
      subtitle={run.id}
      right={<RunStatusChip status={run.status} />}
      footer={
        <Link href={`/runs/${encodeURIComponent(run.id)}`} className="inline-flex items-center gap-1 text-sm font-medium text-foreground hover:text-signal">
          Open run <ArrowUpRight className="size-4" />
        </Link>
      }
    >
      <p className="text-[15px] leading-6 text-foreground/90" title={run.objective}>
        {truncate(run.objective, 120)}
      </p>
      <dl className="mt-5 grid grid-cols-4 gap-px overflow-hidden rounded-md border border-border bg-border">
        <Tile label="Elapsed" value={elapsed == null ? "—" : formatDuration(elapsed)} />
        <Tile label="Confirmed" value={`${confirmed}`} accent={confirmed > 0} />
        <Tile label="Tests" value={`${reproducing}/${tests.length}`} />
        <Tile label="Cost" value={formatUsd(run.cost_usd)} />
      </dl>
      <ul className="mt-5 flex flex-col divide-y divide-border border-y border-border">
        {shown.length === 0 ? (
          <li className="py-3 text-sm text-muted-foreground">No findings recorded yet.</li>
        ) : (
          shown.map((f) => (
            <li key={f.id} className="flex items-center gap-3 py-2.5">
              <span className="eyebrow w-10 shrink-0">{f.id}</span>
              <span className="min-w-0 flex-1 truncate text-sm">{f.title}</span>
              <FindingStatusChip status={f.status} />
            </li>
          ))
        )}
      </ul>
    </Frame>
  );
}

function Tile({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex flex-col gap-1 bg-card px-3 py-2.5">
      <dt className="eyebrow">{label}</dt>
      <dd className={cn("num text-lg leading-none", accent && "text-signal")}>{value}</dd>
    </div>
  );
}

function Frame({
  title,
  subtitle,
  right,
  footer,
  children,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  footer?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="surface w-full max-w-xl overflow-hidden">
      <div className="flex h-11 items-center gap-3 border-b border-border px-4">
        <span className="text-[13px] font-medium">{title}</span>
        {subtitle ? <span className="eyebrow normal-case tracking-normal">{subtitle}</span> : null}
        <span className="ml-auto">{right}</span>
      </div>
      <div className="p-4">{children}</div>
      {footer ? <div className="flex items-center justify-end border-t border-border px-4 py-3">{footer}</div> : null}
    </div>
  );
}

const EXAMPLE = [
  { title: "Plan test strategy", sub: "Decomposed app into 3 workflows: onboarding, workout tracking, profile", state: "done" },
  { title: "Explore onboarding flow", sub: "Created account, verified navigation and state", state: "done" },
  { title: "Investigate potential issue", sub: "Detected inconsistent workout duration persistence", state: "done" },
  { title: "Verify and reproduce issue", sub: "Re-running in clean session to confirm", state: "running" },
  { title: "Generate regression test", sub: "Creating Playwright test from confirmed reproduction", state: "queued" },
] as const;

function ExampleTrace() {
  return (
    <Frame title="Live trace" subtitle="example" right={<RunStatusChip status="running" />}>
      <ol className="relative ml-1.5 border-l border-border">
        {EXAMPLE.map((s) => (
          <li key={s.title} className="relative pl-6 pb-5 last:pb-0">
            <span
              className={cn(
                "absolute top-1 -left-[5px] size-[9px] rounded-full",
                s.state === "done" && "bg-primary",
                s.state === "running" && "pulse-dot bg-primary",
                s.state === "queued" && "border border-border bg-background",
              )}
            />
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className={cn("text-sm font-medium", s.state === "queued" && "text-muted-foreground")}>{s.title}</p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">{s.sub}</p>
              </div>
              <span className={cn("eyebrow inline-flex shrink-0 items-center gap-1.5", s.state === "running" && "text-signal")}>
                {s.state === "done" ? <CircleCheck className="size-3 text-signal" /> : s.state === "running" ? <LoaderCircle className="size-3 animate-spin" /> : <Circle className="size-3" />}
                {s.state === "done" ? "Complete" : s.state === "running" ? "Running" : "Queued"}
              </span>
            </div>
          </li>
        ))}
      </ol>
    </Frame>
  );
}
