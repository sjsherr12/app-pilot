"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Bug, FileText, FlaskConical, ListTodo, TriangleAlert } from "lucide-react";
import { isTerminal, stopRun } from "@/lib/api";
import { useRunEvents } from "@/hooks/useRunEvents";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RunHeader, ProgressStrip } from "./run-header";
import { LiveBrowser } from "./live-browser";
import { AgentFeed } from "./agent-feed";
import { PlanPanel } from "./plan-panel";
import { FindingsPanel } from "./findings-panel";
import { TestsPanel } from "./tests-panel";
import { ReportPanel } from "./report-panel";
import { ShotDialog, useShotDialog } from "./shot-dialog";

function Count({ n, tone }: { n: number; tone?: "danger" | "signal" }) {
  if (!n) return null;
  return (
    <span
      className={
        tone === "danger"
          ? "num rounded-full border border-danger/40 px-1.5 text-[10px] leading-4 text-danger"
          : tone === "signal"
            ? "num rounded-full border border-signal/40 px-1.5 text-[10px] leading-4 text-signal"
            : "num rounded-full border border-border px-1.5 text-[10px] leading-4 text-muted-foreground"
      }
    >
      {n}
    </span>
  );
}

export function RunPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const state = useRunEvents(id);
  const dialog = useShotDialog();
  const [stopping, setStopping] = useState(false);
  const [stopError, setStopError] = useState<string | null>(null);
  const [selectedSessionNonce, setSelectedSessionNonce] = useState<{ session: string; n: number } | null>(null);

  const findings = useMemo(() => Object.values(state.findings), [state.findings]);
  const tests = useMemo(() => Object.values(state.tests), [state.tests]);
  const active = !!state.run && !isTerminal(state.run.status);
  const todosDone = state.todos.filter((t) => t.status === "completed").length;

  const handleStop = async () => {
    if (!id) return;
    setStopping(true);
    setStopError(null);
    try {
      const run = await stopRun(id);
      state.patchRun(run);
    } catch (e) {
      setStopError((e as Error).message);
    } finally {
      setStopping(false);
    }
  };

  if (state.notFound) {
    return (
      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
        <TriangleAlert className="size-7 text-warn" strokeWidth={1.5} />
        <h1 className="heading text-xl">Run not found</h1>
        <p className="text-sm text-muted-foreground">
          No run with id <span className="font-mono">{id}</span> exists on this API.
        </p>
        <Button asChild variant="outline">
          <Link href="/runs">Back to runs</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[1800px] flex-1 flex-col gap-5 px-5 py-6 sm:px-8">
      <RunHeader run={state.run} usage={state.usage} connection={state.connection} onStop={handleStop} stopping={stopping} />

      {state.loadError && !state.run ? (
        <div className="flex items-center gap-2 rounded-md border border-warn/40 bg-warn/8 px-3 py-2 text-sm text-warn">
          <TriangleAlert className="size-4 shrink-0" />
          <span className="min-w-0 flex-1 truncate">{state.loadError}</span>
          <span className="eyebrow text-warn/80">retrying…</span>
        </div>
      ) : null}
      {stopError ? (
        <div className="flex items-center gap-2 rounded-md border border-danger/40 bg-danger/8 px-3 py-2 text-sm text-danger">
          <TriangleAlert className="size-4 shrink-0" />
          <span>Stop failed: {stopError}</span>
        </div>
      ) : null}

      <ProgressStrip todos={state.todos} findings={findings} tests={tests} feed={state.feed} />

      <div className="grid h-[min(58vh,760px)] min-h-[420px] gap-5 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <LiveBrowser
          key={selectedSessionNonce ? `${selectedSessionNonce.session}-${selectedSessionNonce.n}` : "browser"}
          shots={state.shots}
          sessionOrder={state.sessionOrder}
          lastSession={selectedSessionNonce?.session ?? state.lastSession}
          active={active}
          onOpenShot={dialog.show}
        />
        <AgentFeed
          feed={state.feed}
          eventCount={state.eventCount}
          active={active}
          onSelectSession={(session) => setSelectedSessionNonce((p) => ({ session, n: (p?.n ?? 0) + 1 }))}
        />
      </div>

      <Tabs defaultValue="plan" className="min-h-[360px] flex-1 gap-0">
        <TabsList>
          <TabsTrigger value="plan">
            <ListTodo /> Plan {state.todos.length ? <Count n={todosDone} /> : null}
            {state.todos.length ? <span className="num text-[10px] text-muted-foreground">/ {state.todos.length}</span> : null}
          </TabsTrigger>
          <TabsTrigger value="findings">
            <Bug /> Findings <Count n={findings.length} tone="danger" />
          </TabsTrigger>
          <TabsTrigger value="tests">
            <FlaskConical /> Tests <Count n={tests.length} tone="signal" />
          </TabsTrigger>
          <TabsTrigger value="report">
            <FileText /> Report {state.reportMd ? <span className="size-1.5 rounded-full bg-primary" /> : null}
          </TabsTrigger>
        </TabsList>
        <div className="surface mt-4 min-h-[320px] flex-1 overflow-hidden">
          <TabsContent value="plan" className="m-0">
            <PlanPanel todos={state.todos} active={active} />
          </TabsContent>
          <TabsContent value="findings" className="m-0">
            <FindingsPanel findings={findings} tests={state.tests} active={active} onOpenShot={dialog.show} />
          </TabsContent>
          <TabsContent value="tests" className="m-0">
            <TestsPanel tests={tests} findings={state.findings} active={active} onUpdated={state.patchTest} />
          </TabsContent>
          <TabsContent value="report" className="m-0">
            <ReportPanel markdown={state.reportMd ?? state.run?.report_md ?? null} active={active} />
          </TabsContent>
        </div>
      </Tabs>

      <ShotDialog src={dialog.src} title={dialog.title} open={dialog.open} onOpenChange={dialog.onOpenChange} />
    </div>
  );
}
