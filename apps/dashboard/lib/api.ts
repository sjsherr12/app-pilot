// API contract for the AppPilot backend (apps/api). Do not deviate from these
// shapes: the backend implements exactly this.

export type RunStatus = "queued" | "running" | "completed" | "failed" | "stopped";

export interface Run {
  id: string;
  objective: string;
  app_url: string;
  product_notes: string | null;
  status: RunStatus;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  tokens_in: number;
  tokens_out: number;
  cost_usd: number;
  report_md: string | null;
}

export type Severity = "critical" | "high" | "medium" | "low";

export type FindingStatus =
  | "candidate"
  | "confirmed"
  | "potential"
  | "flaky"
  | "env_failure"
  | "inconclusive";

export type AttemptOutcome = "reproduced" | "not_reproduced" | "blocked";

export interface VerificationAttempt {
  attempt: number;
  outcome: AttemptOutcome;
  notes: string;
  shot_urls: string[];
}

export interface Finding {
  id: string;
  run_id: string;
  title: string;
  severity: Severity;
  feature: string;
  expected: string;
  actual: string;
  repro_steps: string[];
  evidence_shots: string[];
  evidence_urls: string[];
  status: FindingStatus;
  verification_attempts: VerificationAttempt[];
  video_url: string | null;
  trace_url: string | null;
  root_cause: string | null;
  test_id: string | null;
  created_at: string;
  updated_at: string;
}

export type TestStatus = "passed" | "failed" | "error" | "timeout";

export interface TestResult {
  status: TestStatus;
  error: string | null;
  duration_ms: number;
  reproduces_bug: boolean;
  ran_at: string;
}

export interface TestCase {
  id: string;
  run_id: string;
  finding_id: string;
  path: string;
  code: string;
  last_result: TestResult | null;
  created_at: string;
  /** Set by POST /api/tests/{id}/export: the branch the spec was pushed to and the pull request opened for it. */
  branch?: string | null;
  pr_url?: string | null;
  exported_at?: string | null;
}

/** Response of POST /api/tests/{id}/export. `pr_url` is null when the branch was pushed but no PR could be opened. */
export interface ExportResult {
  branch: string;
  pr_url: string | null;
  commit: string;
  files: string[];
  message: string;
  test?: TestCase;
}

export type AgentName = "supervisor" | "explorer" | "verifier" | "test_writer" | "system";

export interface RunEvent {
  seq: number;
  ts: string;
  type: string;
  agent: AgentName | null;
  session: string | null;
  payload: Record<string, unknown>;
}

// Event payloads, keyed by event type.
export interface RunStatusPayload {
  status: RunStatus;
  message?: string;
}
export interface AgentStartPayload {
  agent: AgentName;
  description: string;
}
export interface AgentEndPayload {
  agent: AgentName;
  summary: string;
}
export interface LlmUsagePayload {
  model: string;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  cumulative_cost_usd: number;
}
export interface ToolStartPayload {
  tool: string;
  args: unknown;
  call_id: string;
}
export interface ToolEndPayload {
  tool: string;
  call_id: string;
  result_preview: string;
  error?: string;
}
export type BrowserActionKind =
  | "navigate"
  | "click"
  | "type"
  | "select"
  | "press"
  | "scroll"
  | "back"
  | "reload"
  | "reset"
  | "snapshot"
  | "screenshot";
export interface BrowserActionPayload {
  session: string;
  kind: BrowserActionKind;
  target?: { ref: string; role: string; name: string };
  text?: string;
  url: string;
  shot_id: string;
  shot_url: string;
}
export type TodoStatus = "pending" | "in_progress" | "completed";
export interface Todo {
  content: string;
  status: TodoStatus;
}
export interface TodoUpdatePayload {
  todos: Todo[];
}
export interface FindingPayload {
  finding: Finding;
}
export interface TestPayload {
  test: TestCase;
}
export interface TestExportedPayload extends TestPayload {
  branch?: string;
  pr_url?: string | null;
  commit?: string;
  message?: string;
}
export interface ReportFinalPayload {
  report_md: string;
}

export interface RunDetail {
  run: Run;
  findings: Finding[];
  tests: TestCase[];
}

export interface CreateRunBody {
  app_url: string;
  objective: string;
  product_notes?: string;
  credentials?: { username: string; password: string };
}

// ---------------------------------------------------------------------------
// Environment

/** NEXT_PUBLIC_MOCK=1 routes every call to the in-app mock under /api/mock. */
export const MOCK = process.env.NEXT_PUBLIC_MOCK === "1";

/** Base URL of the backend; NEXT_PUBLIC_API_URL, default http://localhost:8000. */
export const API_BASE = MOCK
  ? "/api/mock"
  : (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/+$/, "");

/**
 * Absolute URL for an API path such as /api/runs or /artifacts/<run>/shots/x.png.
 * In mock mode the real /api/... routes live under /api/mock/... and artifacts
 * are served from /api/mock/artifacts/....
 */
export function apiUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  if (MOCK) return `/api/mock${p.replace(/^\/api(?=\/)/, "")}`;
  return `${API_BASE}${p}`;
}

/** Artifact paths (/artifacts/<run>/shots/s0012.png) are relative to the API base. */
export function artifactUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  return apiUrl(path);
}

export function eventsUrl(runId: string): string {
  return apiUrl(`/api/runs/${encodeURIComponent(runId)}/events`);
}

// ---------------------------------------------------------------------------
// Fetch helpers

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(apiUrl(path), {
      cache: "no-store",
      ...init,
      headers: {
        Accept: "application/json",
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...(init?.headers ?? {}),
      },
    });
  } catch (err) {
    const where = MOCK ? "the mock API" : API_BASE;
    throw new ApiError(0, `Could not reach ${where}: ${(err as Error).message}`);
  }
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = (await res.json()) as { detail?: unknown; message?: unknown };
      const d = body.detail ?? body.message;
      if (typeof d === "string") detail = d;
      else if (d) detail = JSON.stringify(d);
    } catch {
      // keep statusText
    }
    throw new ApiError(res.status, `${res.status} ${detail}`);
  }
  return (await res.json()) as T;
}

export async function listRuns(): Promise<Run[]> {
  const data = await request<{ runs: Run[] }>("/api/runs");
  return data.runs;
}

export function createRun(body: CreateRunBody): Promise<Run> {
  return request<Run>("/api/runs", { method: "POST", body: JSON.stringify(body) });
}

export function getRun(id: string): Promise<RunDetail> {
  return request<RunDetail>(`/api/runs/${encodeURIComponent(id)}`);
}

export function stopRun(id: string): Promise<Run> {
  return request<Run>(`/api/runs/${encodeURIComponent(id)}/stop`, { method: "POST" });
}

export function runTest(id: string): Promise<TestCase> {
  return request<TestCase>(`/api/tests/${encodeURIComponent(id)}/run`, { method: "POST" });
}

/** Push the generated spec to a branch and open a GitHub pull request for it (git + gh run on the API host). */
export function exportTest(id: string): Promise<ExportResult> {
  return request<ExportResult>(`/api/tests/${encodeURIComponent(id)}/export`, { method: "POST" });
}

export const TERMINAL_STATUSES: ReadonlySet<RunStatus> = new Set(["completed", "failed", "stopped"]);

export function isTerminal(status: RunStatus | undefined | null): boolean {
  return !!status && TERMINAL_STATUSES.has(status);
}
