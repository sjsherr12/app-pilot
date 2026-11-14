"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, LoaderCircle, RefreshCw, TriangleAlert } from "lucide-react";
import { createRun, listRuns, type CreateRunBody, type Run } from "@/lib/api";
import { formatDateTime, formatRelative, formatUsd, shortUrl, truncate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { RunStatusChip } from "@/components/chips";

const DEFAULT_APP_URL = "http://localhost:3001";
const DEFAULT_OBJECTIVE = "Test this application and find any broken functionality.";
const POLL_MS = 5000;

export function RunsPage() {
  const [runs, setRuns] = useState<Run[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await listRuns();
      setRuns([...data].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") void load();
    };
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, POLL_MS);
    window.addEventListener("focus", tick);
    return () => {
      clearTimeout(first);
      clearInterval(id);
      window.removeEventListener("focus", tick);
    };
  }, [load]);

  const running = runs?.filter((r) => r.status === "running" || r.status === "queued").length ?? 0;
  const totalCost = runs?.reduce((s, r) => s + (r.cost_usd ?? 0), 0) ?? 0;

  return (
    <div className="mx-auto grid w-full max-w-[1800px] flex-1 gap-8 px-5 py-10 sm:px-8 xl:grid-cols-[minmax(0,1fr)_420px]">
      <section className="flex min-w-0 flex-col gap-6">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <p className="eyebrow">Console</p>
            <h1 className="heading mt-2 text-[32px] leading-none">Runs</h1>
            <p className="mt-3 text-sm text-muted-foreground">
              {runs ? (
                <>
                  <span className="num">{runs.length}</span> run{runs.length === 1 ? "" : "s"}
                  {running ? (
                    <>
                      {" · "}
                      <span className="text-signal">
                        <span className="num">{running}</span> active
                      </span>
                    </>
                  ) : null}
                  {runs.length ? (
                    <>
                      {" · "}
                      <span className="num">{formatUsd(totalCost)}</span> total
                    </>
                  ) : null}
                </>
              ) : (
                "Loading…"
              )}
            </p>
          </div>
          <Button variant="ghost" size="sm" className="ml-auto" onClick={refresh} disabled={refreshing}>
            <RefreshCw className={cn(refreshing && "animate-spin")} /> Refresh
          </Button>
        </div>

        {error ? (
          <div className="flex items-center gap-2 rounded-md border border-warn/40 bg-warn/8 px-3 py-2 text-sm text-warn">
            <TriangleAlert className="size-4 shrink-0" />
            <span className="min-w-0 flex-1 truncate">{error}</span>
            <span className="eyebrow text-warn/80">retrying every {POLL_MS / 1000}s</span>
          </div>
        ) : null}

        <div className="surface overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[46%]">Objective</TableHead>
                <TableHead>App</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Cost</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {runs === null && !error ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={6}>
                      <Skeleton className="h-5 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : runs && runs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-40 text-center text-muted-foreground">
                    No runs yet. Point AppPilot at an app with the form.
                  </TableCell>
                </TableRow>
              ) : (
                (runs ?? []).map((run) => <RunRow key={run.id} run={run} />)
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      <NewRunForm />
    </div>
  );
}

function RunRow({ run }: { run: Run }) {
  const router = useRouter();
  const href = `/runs/${encodeURIComponent(run.id)}`;
  return (
    <TableRow className="group cursor-pointer" onClick={() => router.push(href)}>
      <TableCell className="max-w-0">
        <Link href={href} className="block truncate font-medium text-foreground" onClick={(e) => e.stopPropagation()} title={run.objective}>
          {truncate(run.objective, 110)}
        </Link>
        <div className="mt-1 font-mono text-[11px] text-muted-foreground">{run.id}</div>
      </TableCell>
      <TableCell className="font-mono text-xs text-muted-foreground">{shortUrl(run.app_url)}</TableCell>
      <TableCell>
        <RunStatusChip status={run.status} />
      </TableCell>
      <TableCell className="text-xs text-muted-foreground" title={formatDateTime(run.created_at)}>
        {formatRelative(run.created_at)}
      </TableCell>
      <TableCell className="num text-right text-xs">{formatUsd(run.cost_usd)}</TableCell>
      <TableCell className="text-muted-foreground">
        <ArrowRight className="size-4 opacity-0 transition-opacity duration-150 group-hover:opacity-100" />
      </TableCell>
    </TableRow>
  );
}

function NewRunForm() {
  const router = useRouter();
  const [appUrl, setAppUrl] = useState(DEFAULT_APP_URL);
  const [objective, setObjective] = useState(DEFAULT_OBJECTIVE);
  const [notes, setNotes] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const body: CreateRunBody = { app_url: appUrl.trim(), objective: objective.trim() };
    if (notes.trim()) body.product_notes = notes.trim();
    if (username.trim() || password) body.credentials = { username: username.trim(), password };
    try {
      const run = await createRun(body);
      router.push(`/runs/${encodeURIComponent(run.id)}`);
    } catch (err) {
      setError((err as Error).message);
      setSubmitting(false);
    }
  };

  return (
    <section id="new-run" className="surface h-fit scroll-mt-20 xl:sticky xl:top-20">
      <div className="border-b border-border px-5 py-4">
        <p className="eyebrow">Start</p>
        <h2 className="mt-1.5 text-lg font-semibold tracking-[-0.02em]">New run</h2>
        <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
          Point AppPilot at an app. It plans, explores, verifies every bug independently, and writes regression tests.
        </p>
      </div>
      <form onSubmit={onSubmit} className="grid gap-5 p-5">
        <div className="grid gap-2">
          <Label htmlFor="app_url">App URL</Label>
          <Input id="app_url" type="url" required value={appUrl} onChange={(e) => setAppUrl(e.target.value)} placeholder={DEFAULT_APP_URL} className="bg-background font-mono" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="objective">Objective</Label>
          <Textarea id="objective" required rows={3} value={objective} onChange={(e) => setObjective(e.target.value)} className="bg-background" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="product_notes">
            Product notes <span className="font-normal text-muted-foreground">(optional)</span>
          </Label>
          <Textarea
            id="product_notes"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="What the app is for, expected behaviours, known rough edges…"
            className="bg-background"
          />
        </div>
        <div className="grid gap-2">
          <Label>
            Credentials <span className="font-normal text-muted-foreground">(optional)</span>
          </Label>
          <div className="grid grid-cols-2 gap-2">
            <Input aria-label="Username" autoComplete="off" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="username" className="bg-background" />
            <Input aria-label="Password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="password" className="bg-background" />
          </div>
        </div>
        {error ? (
          <div className="flex items-center gap-2 rounded-md border border-danger/40 bg-danger/8 px-3 py-2 text-xs text-danger">
            <TriangleAlert className="size-3.5 shrink-0" /> {error}
          </div>
        ) : null}
        <Button type="submit" disabled={submitting} className="w-full" size="lg">
          {submitting ? <LoaderCircle className="animate-spin" /> : null}
          {submitting ? "Starting…" : "Start run"}
          {!submitting ? <ArrowRight /> : null}
        </Button>
      </form>
    </section>
  );
}
