import { Circle, CircleCheck, ListTodo, LoaderCircle } from "lucide-react";
import type { Todo } from "@/lib/api";
import { TODO_LABEL } from "@/lib/status";
import { cn } from "@/lib/utils";
import { EmptyState } from "./panel";

export function PlanPanel({ todos, active }: { todos: Todo[]; active: boolean }) {
  if (todos.length === 0) {
    return (
      <EmptyState
        icon={<ListTodo className={cn(active && "animate-pulse")} />}
        title={active ? "The supervisor is drafting a plan…" : "No plan was recorded"}
      />
    );
  }
  const done = todos.filter((t) => t.status === "completed").length;
  const pct = Math.round((done / todos.length) * 100);
  return (
    <div className="flex flex-col gap-6 p-5">
      <div className="flex items-center gap-4">
        <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${pct}%` }} />
        </div>
        <span className="num text-xs text-muted-foreground">
          {done}/{todos.length} complete
        </span>
      </div>
      <ol className="relative ml-1.5 border-l border-border">
        {todos.map((t, i) => {
          const running = t.status === "in_progress";
          const complete = t.status === "completed";
          return (
            <li key={`${i}-${t.content}`} className="relative pl-6 pb-5 last:pb-0">
              <span
                className={cn(
                  "absolute top-[7px] -left-[5px] size-[9px] rounded-full",
                  complete && "bg-primary",
                  running && "pulse-dot bg-primary",
                  !complete && !running && "border border-border bg-background",
                )}
              />
              <div className="flex items-start justify-between gap-4">
                <span className={cn("text-sm leading-6", complete && "text-muted-foreground", !complete && !running && "text-foreground/80")}>{t.content}</span>
                <span className={cn("eyebrow inline-flex shrink-0 items-center gap-1.5 pt-1", running && "text-signal")}>
                  {complete ? <CircleCheck className="size-3 text-signal" /> : running ? <LoaderCircle className="size-3 animate-spin" /> : <Circle className="size-3" />}
                  {TODO_LABEL[t.status] ?? t.status}
                </span>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
