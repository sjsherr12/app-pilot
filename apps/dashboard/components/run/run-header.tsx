"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Coins, Cpu, ExternalLink, LoaderCircle, Square, Timer } from "lucide-react";
import type { Finding, Run, TestCase, Todo } from "@/lib/api";
import { isTerminal } from "@/lib/api";
import { formatDuration, formatTokens, formatUsd, shortUrl } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ConnectionState, FeedItem, UsageTotals } from "@/hooks/useRunEvents";
import { Button } from "@/components/ui/button";
import { AgentBadge, RunStatusChip } from "@/components/chips";

function useElapsed(run: Run | null): number | null {
  const activeRun = !!run && !isTerminal(run.status);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!activeRun) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [activeRun]);
  if (!run?.started_at) return null;
  const start = Date.parse(run.started_at);
  const end = run.finished_at ? Date.parse(run.finished_at) : now;
  return Math.max(0, end - start);
}

function Stat({ icon, label, value, className }: { icon: React.ReactNode; label: string; value: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex min-w-[124px] flex-col gap-1.5 rounded-md border border-border bg-card px-4 py-3", className)}>
      <span className="eyebrow inline-flex items-center gap-1.5 [&_svg]:size-3 [&_svg]:stroke-[1.75]">
        {icon}
        {label}
      </span>
      <span className="num text-lg leading-none">{value}</span>
    </div>
  );
}

function LiveDot({ state, terminal }: { state: ConnectionState; terminal: boolean }) {
  const label =
    state === "open"
      ? terminal
        ? "Replay"
        : "Live"
      : state === "connecting"
        ? "Connecting"
        : state === "reconnecting"
          ? "Reconnecting"
          : state === "closed"
            ? "Replay complete"
            : "Idle";
  const live = state === "open" && !terminal;
  const color = live ? "bg-signal" : state === "reconnecting" ? "bg-warn" : state === "connecting" ? "bg-info" : "bg-slate";
  return (
    <span className="eyebrow inline-flex items-center gap-2" title={`Event stream: ${state}`}>
      <span className={cn("size-2 rounded-full", color, live && "pulse-dot")} />
      {label}
    </span>
  );
}

export function RunHeader({
  run,
  usage,
  connection,
  onStop,
  stopping,
}: {
  run: Run | null;
  usage: UsageTotals;
  connection: ConnectionState;
  onStop: () => void;
  stopping: boolean;
}) {
  const elapsed = useElapsed(run);
  const terminal = isTerminal(run?.status);
  const tokensIn = usage.calls > 0 ? usage.tokensIn : (run?.tokens_in ?? 0);
  const tokensOut = usage.calls > 0 ? usage.tokensOut : (run?.tokens_out ?? 0);
  const cost = usage.calls > 0 ? Math.max(usage.costUsd, run?.cost_usd ?? 0) : (run?.cost_usd ?? 0);
  const canStop = !!run && !terminal;

  return (
    <header className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start gap-4">
        <Button asChild variant="ghost" size="icon-sm" className="mt-1 shrink-0">
          <Link href="/runs" title="Back to runs">
            <ArrowLeft />
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="eyebrow">Run</span>
            {run ? <span className="font-mono text-xs text-muted-foreground">{run.id}</span> : null}
            {run?.app_url ? (
              <a href={run.app_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-mono text-xs text-muted-foreground transition-colors hover:text-foreground">
                {shortUrl(run.app_url)} <ExternalLink className="size-3" />
              </a>
            ) : null}
            {usage.lastModel ? <span className="font-mono text-xs text-muted-foreground">{usage.lastModel}</span> : null}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 className="heading line-clamp-2 text-[22px] leading-tight sm:text-[24px]" title={run?.objective ?? ""}>
              {run?.objective ?? "Loading run…"}
            </h1>
          </div>
          <div className="mt-2.5 flex flex-wrap items-center gap-3">
            {run ? <RunStatusChip status={run.status} /> : null}
            <LiveDot state={connection} terminal={terminal} />
          </div>
        </div>
        <div className="flex flex-wrap items-stretch gap-2">
          <Stat icon={<Timer />} label="Elapsed" value={elapsed == null ? "—" : formatDuration(elapsed)} />
          <Stat
            icon={<Cpu />}
            label="Tokens in / out"
            value={
              <>
                {formatTokens(tokensIn)} <span className="text-muted-foreground">/</span> {formatTokens(tokensOut)}
              </>
            }
          />
          <Stat icon={<Coins />} label="Cost" value={formatUsd(cost)} />
          <Button
            variant="destructive"
            className="h-auto self-stretch px-4"
            onClick={onStop}
            disabled={!canStop || stopping}
            title={canStop ? "Stop this run" : "Run already finished"}
          >
            {stopping ? <LoaderCircle className="animate-spin" /> : <Square className="size-3.5 fill-current" />}
            {stopping ? "Stopping…" : "Stop run"}
          </Button>
        </div>
      </div>
      {run && run.status === "running" ? <div className="live-line h-px w-full" /> : <div className="h-px w-full bg-border" />}
    </header>
  );
}

/** Compact progress strip: plan progress, findings, tests, active agents. */
export function ProgressStrip({ todos, findings, tests, feed }: { todos: Todo[]; findings: Finding[]; tests: TestCase[]; feed: FeedItem[] }) {
  const done = todos.filter((t) => t.status === "completed").length;
  const pct = todos.length ? Math.round((done / todos.length) * 100) : 0;
  const confirmed = findings.filter((f) => f.status === "confirmed").length;
  const reproducing = tests.filter((t) => t.last_result?.reproduces_bug).length;
  const activeAgents: string[] = [];
  for (const item of feed) {
    if (item.kind === "agent.start" && item.agent) activeAgents.push(item.agent);
    if (item.kind === "agent.end" && item.agent) {
      const i = activeAgents.indexOf(item.agent);
      if (i >= 0) activeAgents.splice(i, 1);
    }
  }
  return (
    <div className="surface grid gap-px overflow-hidden bg-border sm:grid-cols-2 xl:grid-cols-4">
      <div className="flex flex-col gap-2 bg-card px-4 py-3">
        <div className="flex items-center justify-between">
          <span className="eyebrow">Overall progress</span>
          <span className="num text-sm">{pct}%</span>
        </div>
        <div className="h-1 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <Cell label="Findings" value={<>{confirmed} <span className="text-muted-foreground">confirmed /</span> {findings.length}</>} />
      <Cell label="Regression tests" value={<>{reproducing} <span className="text-muted-foreground">reproducing /</span> {tests.length}</>} />
      <div className="flex flex-col gap-2 bg-card px-4 py-3">
        <span className="eyebrow">Agents</span>
        <div className="flex min-h-[22px] flex-wrap items-center gap-1.5">
          {activeAgents.length === 0 ? (
            <span className="text-sm text-muted-foreground">supervisor</span>
          ) : (
            activeAgents.slice(-3).map((a, i) => <AgentBadge key={`${a}-${i}`} agent={a} />)
          )}
          {activeAgents.length > 0 ? <span className="num ml-auto text-xs text-muted-foreground">{activeAgents.length} active</span> : null}
        </div>
      </div>
    </div>
  );
}

function Cell({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 bg-card px-4 py-3">
      <span className="eyebrow">{label}</span>
      <span className="num text-sm leading-[22px]">{value}</span>
    </div>
  );
}
