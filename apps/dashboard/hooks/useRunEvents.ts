"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
import {
  ApiError,
  eventsUrl,
  getRun,
  isTerminal,
  type AgentEndPayload,
  type AgentName,
  type AgentStartPayload,
  type BrowserActionKind,
  type BrowserActionPayload,
  type Finding,
  type FindingPayload,
  type LlmUsagePayload,
  type ReportFinalPayload,
  type Run,
  type RunDetail,
  type RunEvent,
  type RunStatus,
  type RunStatusPayload,
  type TestCase,
  type TestPayload,
  type Todo,
  type TodoUpdatePayload,
  type ToolEndPayload,
  type ToolStartPayload,
} from "@/lib/api";
import { shortUrl } from "@/lib/format";

// ---------------------------------------------------------------------------
// Derived state shapes

export type FeedKind =
  | "status"
  | "agent.start"
  | "agent.end"
  | "tool"
  | "browser"
  | "usage"
  | "finding"
  | "test"
  | "todo"
  | "report"
  | "other";

export interface ToolCall {
  tool: string;
  callId: string;
  args: unknown;
  resultPreview?: string;
  error?: string;
  done: boolean;
  startedAt: string;
  endedAt?: string;
}

export interface FeedItem {
  key: string;
  seq: number;
  ts: string;
  type: string;
  agent: AgentName | null;
  session: string | null;
  kind: FeedKind;
  text?: string;
  tool?: ToolCall;
  browser?: BrowserActionPayload;
  usage?: LlmUsagePayload;
  finding?: Finding;
  test?: TestCase;
  change?: "created" | "updated" | "saved" | "result" | "exported";
  todos?: Todo[];
  status?: RunStatus;
}

export interface SessionShot {
  session: string;
  agent: AgentName | null;
  shotUrl: string | null;
  url: string;
  kind: BrowserActionKind;
  caption: string;
  seq: number;
  ts: string;
  count: number;
}

export interface UsageTotals {
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
  calls: number;
  lastModel: string | null;
}

export type ConnectionState = "idle" | "connecting" | "open" | "reconnecting" | "closed";

export interface RunState {
  run: Run | null;
  findings: Record<string, Finding>;
  tests: Record<string, TestCase>;
  todos: Todo[];
  shots: Record<string, SessionShot>;
  sessionOrder: string[];
  lastSession: string | null;
  feed: FeedItem[];
  toolIndex: Record<string, number>;
  usage: UsageTotals;
  reportMd: string | null;
  lastSeq: number;
  eventCount: number;
  connection: ConnectionState;
  loading: boolean;
  loadError: string | null;
  notFound: boolean;
}

export function initialState(): RunState {
  return {
    run: null,
    findings: {},
    tests: {},
    todos: [],
    shots: {},
    sessionOrder: [],
    lastSession: null,
    feed: [],
    toolIndex: {},
    usage: { tokensIn: 0, tokensOut: 0, costUsd: 0, calls: 0, lastModel: null },
    reportMd: null,
    lastSeq: 0,
    eventCount: 0,
    connection: "idle",
    loading: true,
    loadError: null,
    notFound: false,
  };
}

// ---------------------------------------------------------------------------
// Helpers

export function describeBrowserAction(p: BrowserActionPayload): string {
  const name = p.target?.name ? `“${p.target.name}”` : p.target?.role ?? "";
  switch (p.kind) {
    case "navigate":
      return `Navigate to ${shortUrl(p.url)}`;
    case "click":
      return `Click ${name || "element"}`;
    case "type":
      return `Type “${p.text ?? ""}” into ${name || "field"}`;
    case "select":
      return `Select “${p.text ?? ""}” in ${name || "dropdown"}`;
    case "press":
      return `Press ${p.text ?? "key"}`;
    case "scroll":
      return p.text ? `Scroll ${p.text}` : "Scroll";
    case "back":
      return "Go back";
    case "reload":
      return "Reload page";
    case "reset":
      return "Reset browser session";
    case "snapshot":
      return "Read page snapshot";
    case "screenshot":
      return "Take screenshot";
    default:
      return String(p.kind);
  }
}

const FEED_CAP = 3000;
const FEED_TRIM = 500;

type Action =
  | { type: "reset" }
  | { type: "loaded"; detail: RunDetail }
  | { type: "load_error"; message: string; notFound: boolean }
  | { type: "events"; events: RunEvent[] }
  | { type: "connection"; state: ConnectionState }
  | { type: "patch_run"; run: Run }
  | { type: "patch_test"; test: TestCase };

function applyEvent(s: RunState, ev: RunEvent): void {
  const payload = (ev.payload ?? {}) as Record<string, unknown>;
  const base = {
    key: `${ev.seq}-${ev.type}`,
    seq: ev.seq,
    ts: ev.ts,
    type: ev.type,
    agent: ev.agent ?? null,
    session: ev.session ?? null,
  };
  const push = (item: Omit<FeedItem, keyof typeof base> & Partial<Pick<FeedItem, "agent" | "session">>) => {
    s.feed.push({ ...base, ...item });
  };

  if (typeof ev.seq === "number" && ev.seq > s.lastSeq) s.lastSeq = ev.seq;
  s.eventCount += 1;

  switch (ev.type) {
    case "run.status": {
      const p = payload as unknown as RunStatusPayload;
      if (s.run) {
        s.run = { ...s.run, status: p.status };
        if (p.status === "running" && !s.run.started_at) s.run.started_at = ev.ts;
        if (isTerminal(p.status) && !s.run.finished_at) s.run.finished_at = ev.ts;
        if (!isTerminal(p.status)) s.run.finished_at = null;
      }
      push({ kind: "status", status: p.status, text: p.message });
      break;
    }
    case "agent.start": {
      const p = payload as unknown as AgentStartPayload;
      push({ kind: "agent.start", agent: p.agent ?? ev.agent ?? null, text: p.description });
      break;
    }
    case "agent.end": {
      const p = payload as unknown as AgentEndPayload;
      push({ kind: "agent.end", agent: p.agent ?? ev.agent ?? null, text: p.summary });
      break;
    }
    case "llm.usage": {
      const p = payload as unknown as LlmUsagePayload;
      s.usage = {
        tokensIn: s.usage.tokensIn + (p.input_tokens ?? 0),
        tokensOut: s.usage.tokensOut + (p.output_tokens ?? 0),
        costUsd:
          typeof p.cumulative_cost_usd === "number"
            ? Math.max(p.cumulative_cost_usd, s.usage.costUsd)
            : s.usage.costUsd + (p.cost_usd ?? 0),
        calls: s.usage.calls + 1,
        lastModel: p.model ?? s.usage.lastModel,
      };
      if (s.run) {
        s.run = {
          ...s.run,
          tokens_in: s.usage.tokensIn,
          tokens_out: s.usage.tokensOut,
          cost_usd: s.usage.costUsd,
        };
      }
      push({ kind: "usage", usage: p });
      break;
    }
    case "tool.start": {
      const p = payload as unknown as ToolStartPayload;
      push({
        kind: "tool",
        tool: { tool: p.tool, callId: p.call_id, args: p.args, done: false, startedAt: ev.ts },
      });
      if (p.call_id) s.toolIndex[p.call_id] = s.feed.length - 1;
      break;
    }
    case "tool.end": {
      const p = payload as unknown as ToolEndPayload;
      const idx = p.call_id ? s.toolIndex[p.call_id] : undefined;
      const existing = idx !== undefined ? s.feed[idx] : undefined;
      if (existing?.tool) {
        s.feed[idx as number] = {
          ...existing,
          tool: {
            ...existing.tool,
            done: true,
            resultPreview: p.result_preview,
            error: p.error,
            endedAt: ev.ts,
          },
        };
      } else {
        push({
          kind: "tool",
          tool: {
            tool: p.tool,
            callId: p.call_id,
            args: undefined,
            done: true,
            resultPreview: p.result_preview,
            error: p.error,
            startedAt: ev.ts,
            endedAt: ev.ts,
          },
        });
      }
      break;
    }
    case "browser.action": {
      const p = payload as unknown as BrowserActionPayload;
      const session = p.session || ev.session || "browser";
      const prev = s.shots[session];
      if (!prev) s.sessionOrder.push(session);
      s.shots[session] = {
        session,
        agent: ev.agent ?? prev?.agent ?? null,
        shotUrl: p.shot_url || prev?.shotUrl || null,
        url: p.url ?? prev?.url ?? "",
        kind: p.kind,
        caption: describeBrowserAction(p),
        seq: ev.seq,
        ts: ev.ts,
        count: (prev?.count ?? 0) + 1,
      };
      s.lastSession = session;
      push({ kind: "browser", browser: p, session, text: describeBrowserAction(p) });
      break;
    }
    case "todo.update": {
      const p = payload as unknown as TodoUpdatePayload;
      s.todos = Array.isArray(p.todos) ? p.todos : [];
      push({ kind: "todo", todos: s.todos });
      break;
    }
    case "finding.created":
    case "finding.updated": {
      const p = payload as unknown as FindingPayload;
      if (p.finding?.id) {
        s.findings[p.finding.id] = p.finding;
        push({
          kind: "finding",
          finding: p.finding,
          change: ev.type === "finding.created" ? "created" : "updated",
        });
      }
      break;
    }
    case "test.saved":
    case "test.result":
    case "test.exported": {
      const p = payload as unknown as TestPayload;
      if (p.test?.id) {
        // Exports carry only branch/pr_url; keep a newer result that may have arrived meanwhile.
        s.tests[p.test.id] = ev.type === "test.exported" ? { ...s.tests[p.test.id], ...p.test } : p.test;
        push({
          kind: "test",
          test: s.tests[p.test.id],
          change: ev.type === "test.saved" ? "saved" : ev.type === "test.result" ? "result" : "exported",
        });
      }
      break;
    }
    case "report.final": {
      const p = payload as unknown as ReportFinalPayload;
      s.reportMd = p.report_md ?? s.reportMd;
      if (s.run) s.run = { ...s.run, report_md: s.reportMd };
      push({ kind: "report", text: "Final report ready" });
      break;
    }
    default: {
      push({ kind: "other", text: ev.type });
    }
  }

  if (s.feed.length > FEED_CAP) {
    s.feed = s.feed.slice(FEED_TRIM);
    const next: Record<string, number> = {};
    s.feed.forEach((item, i) => {
      if (item.tool?.callId && !item.tool.done) next[item.tool.callId] = i;
    });
    s.toolIndex = next;
  }
}

function reducer(state: RunState, action: Action): RunState {
  switch (action.type) {
    case "reset":
      return initialState();
    case "loaded": {
      const { run, findings, tests } = action.detail;
      const f: Record<string, Finding> = { ...state.findings };
      for (const x of findings ?? []) f[x.id] = x;
      const t: Record<string, TestCase> = { ...state.tests };
      for (const x of tests ?? []) t[x.id] = x;
      return {
        ...state,
        run: state.run ? { ...run, ...state.run } : run,
        findings: f,
        tests: t,
        reportMd: state.reportMd ?? run.report_md ?? null,
        loading: false,
        loadError: null,
        notFound: false,
      };
    }
    case "load_error":
      return { ...state, loading: false, loadError: action.message, notFound: action.notFound };
    case "connection":
      return state.connection === action.state ? state : { ...state, connection: action.state };
    case "patch_run":
      return { ...state, run: { ...(state.run ?? action.run), ...action.run } };
    case "patch_test":
      return { ...state, tests: { ...state.tests, [action.test.id]: action.test } };
    case "events": {
      if (!action.events.length) return state;
      const s: RunState = {
        ...state,
        run: state.run ? { ...state.run } : null,
        findings: { ...state.findings },
        tests: { ...state.tests },
        shots: { ...state.shots },
        sessionOrder: [...state.sessionOrder],
        feed: [...state.feed],
        toolIndex: { ...state.toolIndex },
        usage: { ...state.usage },
      };
      for (const ev of action.events) applyEvent(s, ev);
      return s;
    }
    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Hook

export interface UseRunEvents extends RunState {
  patchRun: (run: Run) => void;
  patchTest: (test: TestCase) => void;
}

/**
 * Loads GET /api/runs/{id} once, then opens an EventSource on
 * /api/runs/{id}/events and reduces every event into state. The backend
 * replays persisted events before streaming live ones, so live and finished
 * runs take the same path. Reconnects with backoff while the run is active.
 */
export function useRunEvents(runId: string | undefined): UseRunEvents {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);
  const statusRef = useRef<RunStatus | null>(null);
  const currentStatus = state.run?.status ?? null;
  useEffect(() => {
    statusRef.current = currentStatus;
  }, [currentStatus]);

  useEffect(() => {
    if (!runId) return;
    let cancelled = false;
    let es: EventSource | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let attempt = 0;
    let loadAttempt = 0;
    let streamStatus: RunStatus | null = null;
    const seen = new Set<number>();
    let pending: RunEvent[] = [];
    let flushScheduled = false;

    dispatch({ type: "reset" });

    const flush = () => {
      flushScheduled = false;
      if (!pending.length) return;
      const batch = pending;
      pending = [];
      dispatch({ type: "events", events: batch });
    };
    const scheduleFlush = () => {
      if (flushScheduled) return;
      flushScheduled = true;
      if (typeof requestAnimationFrame === "function") requestAnimationFrame(flush);
      else setTimeout(flush, 16);
    };

    const backoff = (n: number) => Math.min(15_000, 1000 * 2 ** Math.min(n, 4)) + Math.random() * 400;

    const connect = () => {
      if (cancelled) return;
      dispatch({ type: "connection", state: attempt === 0 ? "connecting" : "reconnecting" });
      const source = new EventSource(eventsUrl(runId));
      es = source;
      source.onopen = () => {
        attempt = 0;
        dispatch({ type: "connection", state: "open" });
      };
      source.onmessage = (msg: MessageEvent<string>) => {
        if (!msg.data) return;
        // Each data line is one Event JSON; a message may carry several lines.
        for (const line of String(msg.data).split("\n")) {
          const text = line.trim();
          if (!text) continue;
          try {
            const ev = JSON.parse(text) as RunEvent;
            if (typeof ev.seq === "number") {
              if (seen.has(ev.seq)) continue;
              seen.add(ev.seq);
            }
            if (ev.type === "run.status") {
              const st = (ev.payload as unknown as RunStatusPayload | undefined)?.status;
              if (st) streamStatus = st;
            }
            pending.push(ev);
          } catch {
            // Ignore malformed lines (e.g. keep-alive comments are never delivered here).
          }
        }
        scheduleFlush();
      };
      source.onerror = () => {
        source.close();
        if (es === source) es = null;
        flush();
        if (cancelled) return;
        if (isTerminal(streamStatus) || isTerminal(statusRef.current)) {
          // The server closed the stream of a finished (or just stopped) run.
          dispatch({ type: "connection", state: "closed" });
          return;
        }
        attempt += 1;
        dispatch({ type: "connection", state: "reconnecting" });
        timer = setTimeout(connect, backoff(attempt - 1));
      };
    };

    const load = () => {
      if (cancelled) return;
      getRun(runId)
        .then((detail) => {
          if (cancelled) return;
          dispatch({ type: "loaded", detail });
          connect();
        })
        .catch((err: unknown) => {
          if (cancelled) return;
          const e = err as ApiError;
          const notFound = e instanceof ApiError && e.status === 404;
          dispatch({ type: "load_error", message: e.message ?? String(err), notFound });
          if (notFound) return;
          loadAttempt += 1;
          timer = setTimeout(load, backoff(loadAttempt - 1));
        });
    };

    load();

    return () => {
      cancelled = true;
      es?.close();
      if (timer) clearTimeout(timer);
    };
  }, [runId]);

  const patchRun = useCallback((run: Run) => dispatch({ type: "patch_run", run }), []);
  const patchTest = useCallback((test: TestCase) => dispatch({ type: "patch_test", test }), []);

  return { ...state, patchRun, patchTest };
}
