import type { AgentName, RunStatus, Severity, TestStatus, TodoStatus } from "@/lib/api";

/** Tailwind classes for a flat, 1px-bordered status chip in the brand palette. */
export interface ChipStyle {
  className: string;
  label: string;
  dot?: string;
}

type Tone = "signal" | "warn" | "danger" | "danger-solid" | "info" | "neutral" | "chalk";

const TONE: Record<Tone, string> = {
  signal: "border-signal/40 bg-signal/8 text-signal",
  warn: "border-warn/40 bg-warn/8 text-warn",
  danger: "border-danger/40 bg-danger/8 text-danger",
  "danger-solid": "border-danger bg-danger text-ink",
  info: "border-info/40 bg-info/8 text-info",
  neutral: "border-border bg-transparent text-muted-foreground",
  chalk: "border-chalk/25 bg-transparent text-foreground",
};

const DOT: Record<Tone, string> = {
  signal: "bg-signal",
  warn: "bg-warn",
  danger: "bg-danger",
  "danger-solid": "bg-ink",
  info: "bg-info",
  neutral: "bg-slate",
  chalk: "bg-chalk",
};

const chip = (tone: Tone, label: string): ChipStyle => ({ className: TONE[tone], dot: DOT[tone], label });

// Tailwind only generates classes it can see as literal strings; every class used above is listed here.
export const _TAILWIND_SAFELIST = [
  "border-signal/40 bg-signal/8 text-signal bg-signal",
  "border-warn/40 bg-warn/8 text-warn bg-warn",
  "border-danger/40 bg-danger/8 text-danger bg-danger",
  "border-danger bg-danger text-ink bg-ink",
  "border-info/40 bg-info/8 text-info bg-info",
  "border-border bg-transparent text-muted-foreground bg-slate",
  "border-chalk/25 text-foreground bg-chalk",
];

export const RUN_STATUS: Record<RunStatus, ChipStyle> = {
  queued: chip("neutral", "Queued"),
  running: chip("signal", "In progress"),
  completed: chip("chalk", "Completed"),
  failed: chip("danger", "Failed"),
  stopped: chip("warn", "Stopped"),
};

/** Finding statuses from the contract, plus "feature" which the UI also styles. */
export const FINDING_STATUS: Record<string, ChipStyle> = {
  candidate: chip("warn", "Candidate"),
  confirmed: chip("danger", "Confirmed"),
  potential: chip("warn", "Potential"),
  flaky: chip("info", "Flaky"),
  env_failure: chip("neutral", "Env failure"),
  inconclusive: chip("neutral", "Inconclusive"),
  feature: chip("neutral", "Feature"),
};

export const SEVERITY: Record<Severity, ChipStyle> = {
  critical: chip("danger-solid", "Critical"),
  high: chip("danger", "High"),
  medium: chip("warn", "Medium"),
  low: chip("neutral", "Low"),
};

export const SEVERITY_ORDER: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3 };

export const TEST_STATUS: Record<TestStatus, ChipStyle> = {
  passed: chip("signal", "Passed"),
  failed: chip("danger", "Failed"),
  error: chip("warn", "Error"),
  timeout: chip("warn", "Timeout"),
};

export const ATTEMPT_OUTCOME: Record<string, ChipStyle> = {
  reproduced: chip("danger", "Reproduced"),
  not_reproduced: chip("signal", "Not reproduced"),
  blocked: chip("warn", "Blocked"),
};

export const AGENT: Record<AgentName, ChipStyle> = {
  supervisor: chip("chalk", "supervisor"),
  explorer: chip("signal", "explorer"),
  verifier: chip("warn", "verifier"),
  test_writer: chip("info", "test_writer"),
  system: chip("neutral", "system"),
};

export const TODO_LABEL: Record<TodoStatus, string> = {
  pending: "Queued",
  in_progress: "Running",
  completed: "Complete",
};

export function styleFor<K extends string>(table: Record<K, ChipStyle>, key: K | string | null | undefined): ChipStyle {
  if (key && key in table) return table[key as K];
  return { className: TONE.neutral, dot: DOT.neutral, label: String(key ?? "unknown") };
}
