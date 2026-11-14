// In-memory mock backend state. Lives on globalThis so it survives HMR in dev.
// Playback is time-based: once a run's event stream is first opened, event i
// is "persisted" at start + i * LIVE_SPACING_MS, so GET /api/runs/{id} and the
// SSE replay stay consistent across tabs and reloads.

import type { ExportResult, Finding, Run, RunDetail, RunEvent, RunStatus, TestCase } from "@/lib/api";
import { buildFixture, type FixtureVariant } from "./fixture";

export const LIVE_SPACING_MS = 300;
export const REPLAY_SPACING_MS = 6;

interface RunRecord {
  base: Run;
  variant: FixtureVariant;
  /** Seeded finished runs use realistic gaps instead of 300ms playback. */
  realistic: boolean;
  playbackStartedAt: number | null;
  /** Number of fixture events delivered before the user pressed Stop. */
  stoppedAtIndex: number | null;
  stoppedAt: number | null;
}

const g = globalThis as unknown as { __apppilotMockStore?: Map<string, RunRecord> };

const OBJECTIVE = "Test this application and find any broken functionality.";
const SHOP = "http://localhost:3001";

function iso(ms: number): string {
  return new Date(ms).toISOString();
}

function hash(n: number): number {
  let x = (n + 1) * 2654435761;
  x = (x ^ (x >>> 13)) * 1274126177;
  return (x ^ (x >>> 16)) >>> 0;
}

/** Realistic gap between consecutive events, 1.2s to 6.4s, deterministic. */
function realisticOffset(index: number): number {
  let total = 0;
  for (let k = 0; k <= index; k++) total += 1200 + (hash(k) % 5200);
  return total;
}

function seed(): Map<string, RunRecord> {
  const now = Date.now();
  const m = new Map<string, RunRecord>();
  const mk = (
    id: string,
    createdAt: number,
    status: RunStatus,
    variant: FixtureVariant,
    objective: string,
    notes: string | null,
  ): RunRecord => ({
    base: {
      id,
      objective,
      app_url: SHOP,
      product_notes: notes,
      status,
      created_at: iso(createdAt),
      started_at: null,
      finished_at: null,
      tokens_in: 0,
      tokens_out: 0,
      cost_usd: 0,
      report_md: null,
    },
    variant,
    realistic: status !== "queued",
    playbackStartedAt: status === "queued" ? null : createdAt + 4000,
    stoppedAtIndex: null,
    stoppedAt: null,
  });

  m.set(
    "run_7f3a2c",
    mk("run_7f3a2c", now - 2 * 3600_000, "completed", "full", OBJECTIVE, "Demo shop. Coupon SAVE10 should give 10% off once per order. Checkout uses a payment stub."),
  );
  m.set(
    "run_c21d9e",
    mk("run_c21d9e", now - 26 * 3600_000, "failed", "failed", "Smoke test the checkout flow with the SAVE10 coupon.", null),
  );
  m.set(
    "run_e9b04f",
    mk("run_e9b04f", now - 3 * 86400_000, "stopped", "stopped", "Explore the catalog and search for broken links or missing images.", null),
  );
  m.set("run_demo01", mk("run_demo01", now - 20_000, "queued", "full", OBJECTIVE, "Demo shop. Coupon SAVE10 should give 10% off once per order."));
  return m;
}

function store(): Map<string, RunRecord> {
  if (!g.__apppilotMockStore) g.__apppilotMockStore = seed();
  return g.__apppilotMockStore;
}

function tsOf(rec: RunRecord): (i: number) => string {
  const start = rec.playbackStartedAt ?? Date.parse(rec.base.created_at);
  return (i: number) => iso(start + (rec.realistic ? realisticOffset(i) : i * LIVE_SPACING_MS));
}

export interface Materialized {
  run: Run;
  findings: Finding[];
  tests: TestCase[];
  /** Full event list including a synthetic stop event when the user stopped the run. */
  events: RunEvent[];
  /** How many of `events` have been "persisted" so far. */
  delivered: number;
  spacingMs: number;
}

function deliveredCount(rec: RunRecord, total: number, now: number): number {
  if (rec.playbackStartedAt == null) return 0;
  if (rec.stoppedAtIndex != null) return Math.min(total, rec.stoppedAtIndex + 1);
  if (rec.realistic) return total;
  return Math.min(total, Math.floor((now - rec.playbackStartedAt) / LIVE_SPACING_MS) + 1);
}

export function materialize(rec: RunRecord, now = Date.now()): Materialized {
  const ts = tsOf(rec);
  const fixture = buildFixture(rec.base.id, ts, rec.variant);
  let events = fixture.events;
  if (rec.stoppedAtIndex != null) {
    const kept = events.slice(0, rec.stoppedAtIndex);
    const seq = kept.length + 1;
    events = [
      ...kept,
      {
        seq,
        ts: iso(rec.stoppedAt ?? now),
        type: "run.status",
        agent: "system",
        session: null,
        payload: { status: "stopped", message: "Stopped by user" },
      },
    ];
  }
  const delivered = deliveredCount(rec, events.length, now);

  // Reduce the delivered prefix into REST-shaped state.
  const findings = new Map<string, Finding>();
  const tests = new Map<string, TestCase>();
  let status: RunStatus = rec.base.status === "queued" ? "queued" : "queued";
  let startedAt: string | null = null;
  let finishedAt: string | null = null;
  let tokensIn = 0;
  let tokensOut = 0;
  let cost = 0;
  let report: string | null = null;
  for (const ev of events.slice(0, delivered)) {
    const p = ev.payload as Record<string, unknown>;
    switch (ev.type) {
      case "run.status": {
        status = p.status as RunStatus;
        if (status === "running" && !startedAt) startedAt = ev.ts;
        if (status === "completed" || status === "failed" || status === "stopped") finishedAt = ev.ts;
        break;
      }
      case "llm.usage":
        tokensIn += (p.input_tokens as number) ?? 0;
        tokensOut += (p.output_tokens as number) ?? 0;
        cost = Math.max(cost, (p.cumulative_cost_usd as number) ?? 0);
        break;
      case "finding.created":
      case "finding.updated": {
        const f = p.finding as Finding;
        findings.set(f.id, f);
        break;
      }
      case "test.saved":
      case "test.result": {
        const t = p.test as TestCase;
        tests.set(t.id, t);
        break;
      }
      case "report.final":
        report = p.report_md as string;
        break;
    }
  }
  if (status === "completed") {
    // Finished runs expose the final finding/test objects (with test_id linked).
    for (const f of fixture.findings) findings.set(f.id, f);
    for (const t of fixture.tests) tests.set(t.id, t);
    report = fixture.reportMd || report;
  }
  const run: Run = {
    ...rec.base,
    status,
    started_at: startedAt,
    finished_at: finishedAt,
    tokens_in: tokensIn,
    tokens_out: tokensOut,
    cost_usd: Number(cost.toFixed(4)),
    report_md: report,
  };
  return {
    run,
    findings: [...findings.values()],
    tests: [...tests.values()],
    events,
    delivered,
    spacingMs: rec.realistic ? REPLAY_SPACING_MS : LIVE_SPACING_MS,
  };
}

export function getRecord(id: string): RunRecord | undefined {
  return store().get(id);
}

export function listRuns(): Run[] {
  const now = Date.now();
  return [...store().values()]
    .map((r) => materialize(r, now).run)
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
}

export function getRunDetail(id: string): RunDetail | null {
  const rec = getRecord(id);
  if (!rec) return null;
  const m = materialize(rec);
  return { run: m.run, findings: m.findings, tests: m.tests };
}

export function createRun(body: { app_url: string; objective: string; product_notes?: string }): Run {
  const id = `run_${Math.random().toString(16).slice(2, 8)}`;
  const rec: RunRecord = {
    base: {
      id,
      objective: body.objective || OBJECTIVE,
      app_url: body.app_url || SHOP,
      product_notes: body.product_notes?.trim() ? body.product_notes : null,
      status: "queued",
      created_at: iso(Date.now()),
      started_at: null,
      finished_at: null,
      tokens_in: 0,
      tokens_out: 0,
      cost_usd: 0,
      report_md: null,
    },
    variant: "full",
    realistic: false,
    playbackStartedAt: null,
    stoppedAtIndex: null,
    stoppedAt: null,
  };
  store().set(id, rec);
  return materialize(rec).run;
}

/** Called when a client opens the event stream: live playback starts now. */
export function ensurePlayback(rec: RunRecord): void {
  if (rec.playbackStartedAt == null) rec.playbackStartedAt = Date.now();
}

export function stopRun(id: string): Run | null {
  const rec = getRecord(id);
  if (!rec) return null;
  const now = Date.now();
  const m = materialize(rec, now);
  if (m.run.status === "queued" || m.run.status === "running") {
    if (rec.playbackStartedAt == null) rec.playbackStartedAt = now;
    rec.stoppedAtIndex = Math.min(m.delivered, m.events.length - 1);
    rec.stoppedAt = now;
  }
  return materialize(rec, now).run;
}

function findTest(testId: string, now = Date.now()): TestCase | null {
  let found: TestCase | null = null;
  let newest = -1;
  for (const rec of store().values()) {
    const m = materialize(rec, now);
    const t = m.tests.find((x) => x.id === testId);
    const started = rec.playbackStartedAt ?? 0;
    if (t && started >= newest) {
      newest = started;
      found = t;
    }
  }
  return found;
}

export function rerunTest(testId: string): TestCase | null {
  const now = Date.now();
  const found = findTest(testId, now);
  if (!found) return null;
  const prev = found.last_result;
  return {
    ...found,
    last_result: {
      status: prev?.status ?? "failed",
      error: prev?.error ?? null,
      duration_ms: 3200 + Math.floor(Math.random() * 1800),
      reproduces_bug: prev?.reproduces_bug ?? true,
      ran_at: iso(now),
    },
  };
}

/** Mock of POST /api/tests/{id}/export: pretends the spec was pushed and a pull request opened. */
export function exportTest(testId: string): ExportResult | null {
  const found = findTest(testId);
  if (!found) return null;
  const branch = `apppilot/${found.finding_id}-${found.run_id.replace(/^run_/, "")}`;
  const pr_url = `https://github.com/example/shop/pull/${40 + (hash(found.id.length) % 60)}`;
  const test: TestCase = { ...found, branch, pr_url, exported_at: iso(Date.now()) };
  return {
    branch,
    pr_url,
    commit: "9f2c1e7d4b8a6c3e5d0f1a2b3c4d5e6f70819a2b",
    files: [`packages/regression-tests/${found.path}`, ".github/workflows/regression.yml"],
    message: `Created branch ${branch} from HEAD, pushed it to origin and opened a pull request.`,
    test,
  };
}

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
