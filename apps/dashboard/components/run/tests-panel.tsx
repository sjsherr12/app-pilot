"use client";

import { useState } from "react";
import { ExternalLink, FlaskConical, GitPullRequestArrow, LoaderCircle, RefreshCw } from "lucide-react";
import type { Finding, TestCase } from "@/lib/api";
import { exportTest, runTest } from "@/lib/api";
import { formatDateTime, formatMs, prLabel } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { TestStatusChip } from "@/components/chips";
import { EmptyState } from "./panel";

export function TestsPanel({
  tests,
  findings,
  active,
  onUpdated,
}: {
  tests: TestCase[];
  findings: Record<string, Finding>;
  active: boolean;
  onUpdated: (test: TestCase) => void;
}) {
  if (tests.length === 0) {
    return (
      <EmptyState
        icon={<FlaskConical className={cn(active && "animate-pulse")} />}
        title={active ? "No tests yet. The test writer starts after findings are verified." : "No regression tests were written"}
      />
    );
  }
  const sorted = [...tests].sort((a, b) => a.created_at.localeCompare(b.created_at));
  return (
    <div className="grid gap-5 p-5 xl:grid-cols-2">
      {sorted.map((t) => (
        <TestCard key={t.id} test={t} finding={findings[t.finding_id]} onUpdated={onUpdated} />
      ))}
    </div>
  );
}

/** Link to the pull request a test was exported to; an outline button with the Signal accent. */
export function PullRequestLink({ url, className }: { url: string; className?: string }) {
  return (
    <Button asChild size="sm" variant="outline" className={cn("border-signal/40 text-signal hover:border-signal/60 hover:bg-signal/10 hover:text-signal", className)}>
      <a href={url} target="_blank" rel="noreferrer" title={`Open ${url}`}>
        <GitPullRequestArrow />
        {prLabel(url)}
        <ExternalLink className="size-3 opacity-70" />
      </a>
    </Button>
  );
}

function TestCard({ test: t, finding, onUpdated }: { test: TestCase; finding?: Finding; onUpdated: (t: TestCase) => void }) {
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportNote, setExportNote] = useState<string | null>(null);
  const r = t.last_result;

  const rerun = async () => {
    setRunning(true);
    setRunError(null);
    try {
      const updated = await runTest(t.id);
      onUpdated(updated);
    } catch (e) {
      setRunError((e as Error).message);
    } finally {
      setRunning(false);
    }
  };

  const exportToPr = async () => {
    setExporting(true);
    setExportError(null);
    setExportNote(null);
    try {
      const res = await exportTest(t.id);
      onUpdated(res.test ?? { ...t, branch: res.branch, pr_url: res.pr_url ?? t.pr_url ?? null, exported_at: new Date().toISOString() });
      // Branch pushed but no PR link (gh missing or failed): the message says what to do by hand.
      if (!res.pr_url) setExportNote(res.message);
    } catch (e) {
      setExportError((e as Error).message);
    } finally {
      setExporting(false);
    }
  };

  return (
    <article className="feed-in flex flex-col gap-4 rounded-lg border border-border bg-background p-5">
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <FlaskConical className="size-4 shrink-0 text-signal" />
          <span className="min-w-0 flex-1 truncate font-mono text-[13px] text-foreground" title={t.path}>
            {t.path}
          </span>
          {r ? <TestStatusChip status={r.status} /> : <span className="eyebrow">not run yet</span>}
          {r?.reproduces_bug ? (
            <span className="inline-flex h-[22px] items-center rounded-full border border-signal/40 bg-signal/8 px-2 text-[11px] font-medium text-signal">Reproduces bug</span>
          ) : null}
          {r ? <span className="num text-xs text-muted-foreground">{formatMs(r.duration_ms)}</span> : null}
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="min-w-0 flex-1 text-xs leading-5 text-muted-foreground">
            <div className="truncate">
              Finding <span className="font-mono text-foreground/85">{t.finding_id}</span>
              {finding ? <span className="text-foreground/80"> · {finding.title}</span> : null}
            </div>
            <div className="flex flex-wrap gap-x-3">
              {t.branch ? (
                <span className="truncate">
                  branch <span className="font-mono text-foreground/85">{t.branch}</span>
                  {t.exported_at ? <span> · exported {formatDateTime(t.exported_at)}</span> : null}
                </span>
              ) : null}
              {r ? <span className="font-mono">ran {formatDateTime(r.ran_at)}</span> : null}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {t.pr_url ? <PullRequestLink url={t.pr_url} /> : null}
            <Button size="sm" variant="outline" onClick={rerun} disabled={running}>
              {running ? <LoaderCircle className="animate-spin" /> : <RefreshCw />}
              {running ? "Running…" : "Run again"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={exportToPr}
              disabled={exporting}
              title={
                t.pr_url
                  ? "Push the current spec to the same branch; the open pull request picks it up"
                  : "Push this spec to a branch and open a GitHub pull request with the bug report"
              }
            >
              {exporting ? <LoaderCircle className="animate-spin" /> : <GitPullRequestArrow />}
              {exporting ? "Exporting…" : "Export to PR"}
            </Button>
          </div>
        </div>
      </header>
      <pre className="scroll-thin max-h-72 overflow-auto rounded-md border border-border bg-card p-3 font-mono text-[12px] leading-5 text-foreground/90">
        <code>{t.code}</code>
      </pre>
      {r?.error ? (
        <pre className="scroll-thin max-h-40 overflow-auto rounded-md border border-danger/30 bg-danger/5 p-3 font-mono text-[12px] leading-5 whitespace-pre-wrap text-danger">
          {r.error}
        </pre>
      ) : null}
      {runError ? <p className="text-xs text-danger">Run failed: {runError}</p> : null}
      {exportError ? <p className="text-xs text-danger">Export failed: {exportError}</p> : null}
      {exportNote ? <p className="text-xs text-warn">{exportNote}</p> : null}
    </article>
  );
}
