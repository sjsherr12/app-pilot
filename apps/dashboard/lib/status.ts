import type { AgentName, RunStatus, Severity, TestStatus, TodoStatus } from "@/lib/api";

/** Tailwind classes for a soft tinted chip. */
export interface ChipStyle {
  className: string;
  label: string;
  dot?: string;
}

const chip = (color: string, label: string): ChipStyle => ({
  className: `bg-${color}-500/15 text-${color}-300 border-${color}-500/30`,
  dot: `bg-${color}-400`,
  label,
});

// Tailwind only generates classes it can see as literal strings, so every
// combination used above is listed here verbatim (never remove this block).
export const _TAILWIND_SAFELIST = [
  "bg-zinc-500/15 text-zinc-300 border-zinc-500/30 bg-zinc-400",
  "bg-sky-500/15 text-sky-300 border-sky-500/30 bg-sky-400",
  "bg-emerald-500/15 text-emerald-300 border-emerald-500/30 bg-emerald-400",
  "bg-rose-500/15 text-rose-300 border-rose-500/30 bg-rose-400",
  "bg-amber-500/15 text-amber-300 border-amber-500/30 bg-amber-400",
  "bg-orange-500/15 text-orange-300 border-orange-500/30 bg-orange-400",
  "bg-violet-500/15 text-violet-300 border-violet-500/30 bg-violet-400",
  "bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/30 bg-fuchsia-400",
  "bg-slate-500/15 text-slate-300 border-slate-500/30 bg-slate-400",
  "bg-teal-500/15 text-teal-300 border-teal-500/30 bg-teal-400",
  "bg-lime-500/15 text-lime-300 border-lime-500/30 bg-lime-400",
];

export const RUN_STATUS: Record<RunStatus, ChipStyle> = {
  queued: chip("zinc", "Queued"),
  running: chip("sky", "Running"),
  completed: chip("emerald", "Completed"),
  failed: chip("rose", "Failed"),
  stopped: chip("amber", "Stopped"),
};

/** Finding statuses from the contract, plus "feature" which the UI also styles. */
export const FINDING_STATUS: Record<string, ChipStyle> = {
  candidate: chip("sky", "Candidate"),
  confirmed: chip("rose", "Confirmed"),
  potential: chip("orange", "Potential"),
  flaky: chip("violet", "Flaky"),
  env_failure: chip("slate", "Env failure"),
  inconclusive: chip("zinc", "Inconclusive"),
  feature: chip("teal", "Feature"),
};

export const SEVERITY: Record<Severity, ChipStyle> = {
  critical: chip("rose", "Critical"),
  high: chip("orange", "High"),
  medium: chip("amber", "Medium"),
  low: chip("sky", "Low"),
};

export const SEVERITY_ORDER: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3 };

export const TEST_STATUS: Record<TestStatus, ChipStyle> = {
  passed: chip("emerald", "Passed"),
  failed: chip("rose", "Failed"),
  error: chip("orange", "Error"),
  timeout: chip("amber", "Timeout"),
};

export const ATTEMPT_OUTCOME: Record<string, ChipStyle> = {
  reproduced: chip("rose", "Reproduced"),
  not_reproduced: chip("emerald", "Not reproduced"),
  blocked: chip("amber", "Blocked"),
};

export const AGENT: Record<AgentName, ChipStyle> = {
  supervisor: chip("violet", "supervisor"),
  explorer: chip("sky", "explorer"),
  verifier: chip("amber", "verifier"),
  test_writer: chip("emerald", "test_writer"),
  system: chip("zinc", "system"),
};

export const TODO_LABEL: Record<TodoStatus, string> = {
  pending: "Pending",
  in_progress: "In progress",
  completed: "Done",
};

export function styleFor<K extends string>(table: Record<K, ChipStyle>, key: K | string | null | undefined): ChipStyle {
  if (key && key in table) return table[key as K];
  return { className: "bg-zinc-500/15 text-zinc-300 border-zinc-500/30", label: String(key ?? "unknown") };
}
