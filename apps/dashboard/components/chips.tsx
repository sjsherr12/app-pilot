import { CircleCheckBig, CircleDashed, LoaderCircle, OctagonX, Square, type LucideIcon } from "lucide-react";
import type { AgentName, RunStatus, Severity, TestStatus } from "@/lib/api";
import { AGENT, ATTEMPT_OUTCOME, FINDING_STATUS, RUN_STATUS, SEVERITY, TEST_STATUS, styleFor, type ChipStyle } from "@/lib/status";
import { cn } from "@/lib/utils";

const base =
  "inline-flex h-[22px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2 text-[11px] font-medium leading-none";

export function Chip({ style, className, icon: Icon, children }: { style: ChipStyle; className?: string; icon?: LucideIcon; children?: React.ReactNode }) {
  return (
    <span className={cn(base, style.className, className)}>
      {Icon ? <Icon className="size-3" /> : null}
      {children ?? style.label}
    </span>
  );
}

const RUN_ICON: Record<RunStatus, LucideIcon> = {
  queued: CircleDashed,
  running: LoaderCircle,
  completed: CircleCheckBig,
  failed: OctagonX,
  stopped: Square,
};

export function RunStatusChip({ status, className }: { status: RunStatus; className?: string }) {
  const style = styleFor(RUN_STATUS, status);
  const Icon = RUN_ICON[status] ?? CircleDashed;
  return (
    <span className={cn(base, style.className, className)}>
      <Icon className={cn("size-3", status === "running" && "animate-spin [animation-duration:1.4s]")} />
      {style.label}
    </span>
  );
}

export function FindingStatusChip({ status, className }: { status: string; className?: string }) {
  const style = styleFor(FINDING_STATUS, status);
  return (
    <span className={cn(base, style.className, className)}>
      <span className={cn("size-1.5 rounded-full", style.dot ?? "bg-slate")} />
      {style.label}
    </span>
  );
}

export function SeverityBadge({ severity, className }: { severity: Severity; className?: string }) {
  const style = styleFor(SEVERITY, severity);
  return <span className={cn(base, "font-mono uppercase tracking-[0.06em]", style.className, className)}>{style.label}</span>;
}

export function TestStatusChip({ status, className }: { status: TestStatus; className?: string }) {
  return <Chip style={styleFor(TEST_STATUS, status)} className={className} />;
}

export function OutcomeChip({ outcome, className }: { outcome: string; className?: string }) {
  return <Chip style={styleFor(ATTEMPT_OUTCOME, outcome)} className={className} />;
}

export function AgentBadge({ agent, className }: { agent: AgentName | string | null | undefined; className?: string }) {
  const style = styleFor(AGENT, agent ?? "system");
  return (
    <span className={cn(base, "font-mono", style.className, className)}>
      <span className={cn("size-1.5 rounded-full", style.dot ?? "bg-slate")} />
      {agent ?? "system"}
    </span>
  );
}
