"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Activity,
  ArrowDownToLine,
  ChevronRight,
  CircleCheck,
  ExternalLink,
  CircleX,
  FileText,
  FlaskConical,
  Globe,
  ListTodo,
  LoaderCircle,
  Pause,
  Play,
  Bug,
  Wrench,
  Zap,
} from "lucide-react";
import type { FeedItem } from "@/hooks/useRunEvents";
import { formatClock, formatMs, formatTokens, formatUsd, prLabel, safeJson } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { AgentBadge, FindingStatusChip, RunStatusChip, SeverityBadge, TestStatusChip } from "@/components/chips";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { KIND_ICON } from "./live-browser";
import { Panel, EmptyState } from "./panel";

export function AgentFeed({
  feed,
  eventCount,
  active,
  onSelectSession,
  className,
}: {
  feed: FeedItem[];
  eventCount?: number;
  active: boolean;
  onSelectSession?: (session: string) => void;
  className?: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [atBottom, setAtBottom] = useState(true);
  const programmatic = useRef(false);

  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    programmatic.current = true;
    el.scrollTop = el.scrollHeight;
    requestAnimationFrame(() => {
      programmatic.current = false;
    });
  }, []);

  useEffect(() => {
    if (autoScroll) scrollToBottom();
  }, [feed.length, autoScroll, scrollToBottom]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    const bottom = distance < 24;
    setAtBottom(bottom);
    // Scrolling up by hand pauses auto-scroll so the user can read.
    if (!programmatic.current && !bottom && autoScroll) setAutoScroll(false);
  };

  return (
    <Panel
      title="Agent feed"
      icon={<Activity />}
      className={className}
      actions={
        <>
          <span className="eyebrow">{eventCount ?? feed.length} events</span>
          <label className="eyebrow flex items-center gap-2">
            {autoScroll ? <Play className="size-3" /> : <Pause className="size-3" />}
            Auto-scroll
            <Switch size="sm" checked={autoScroll} onCheckedChange={(v) => setAutoScroll(v)} />
          </label>
        </>
      }
      bodyClassName="relative"
    >
      <div ref={scrollRef} onScroll={onScroll} className="scroll-thin absolute inset-0 overflow-y-auto px-2 py-2">
        {feed.length === 0 ? (
          <EmptyState
            icon={<Activity className={cn(active && "animate-pulse")} />}
            title={active ? "Waiting for events…" : "No events yet"}
            hint="Supervisor, explorer, verifier and test-writer activity streams here in real time."
          />
        ) : (
          <ol className="flex flex-col gap-0.5">
            {feed.map((item) => (
              <FeedRow key={item.key} item={item} onSelectSession={onSelectSession} />
            ))}
          </ol>
        )}
      </div>
      {!autoScroll && !atBottom ? (
        <Button
          size="sm"
          variant="secondary"
          className="absolute bottom-3 left-1/2 -translate-x-1/2 border border-border"
          onClick={() => {
            setAutoScroll(true);
            scrollToBottom();
          }}
        >
          <ArrowDownToLine /> Jump to latest
        </Button>
      ) : null}
    </Panel>
  );
}

function Row({
  ts,
  className,
  children,
  highlight,
}: {
  ts: string;
  className?: string;
  children: React.ReactNode;
  highlight?: "finding" | "test";
}) {
  return (
    <li
      className={cn(
        "feed-in flex items-start gap-2.5 rounded-md px-2 py-1.5 text-[13px] leading-5",
        highlight === "finding" && "border-l-2 border-l-danger bg-danger/5",
        highlight === "test" && "border-l-2 border-l-signal bg-signal/5",
        className,
      )}
    >
      <time className="num mt-0.5 w-[60px] shrink-0 text-[11px] text-muted-foreground/70">{formatClock(ts)}</time>
      <div className="min-w-0 flex-1">{children}</div>
    </li>
  );
}

function FeedRow({ item, onSelectSession }: { item: FeedItem; onSelectSession?: (s: string) => void }) {
  switch (item.kind) {
    case "status":
      return (
        <Row ts={item.ts}>
          <div className="flex flex-wrap items-center gap-2 text-muted-foreground">
            <span className="text-xs">Run</span>
            {item.status ? <RunStatusChip status={item.status} /> : null}
            {item.text ? <span className="text-xs">{item.text}</span> : null}
          </div>
        </Row>
      );
    case "agent.start":
      return (
        <Row ts={item.ts}>
          <div className="flex flex-wrap items-center gap-2">
            <AgentBadge agent={item.agent} />
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Play className="size-3" /> started
            </span>
            <span className="text-foreground/90">{item.text}</span>
          </div>
        </Row>
      );
    case "agent.end":
      return (
        <Row ts={item.ts}>
          <div className="flex flex-wrap items-center gap-2">
            <AgentBadge agent={item.agent} />
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <CircleCheck className="size-3" /> finished
            </span>
            <span className="text-foreground/80">{item.text}</span>
          </div>
        </Row>
      );
    case "tool":
      return (
        <Row ts={item.ts}>
          <ToolRow item={item} />
        </Row>
      );
    case "browser": {
      const Icon = item.browser ? (KIND_ICON[item.browser.kind] ?? Globe) : Globe;
      return (
        <Row ts={item.ts}>
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              className="shrink-0 rounded-sm border border-border px-1.5 font-mono text-[11px] leading-[18px] text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground"
              onClick={() => item.session && onSelectSession?.(item.session)}
              title="Show this session in the live browser"
            >
              {item.session}
            </button>
            <Icon className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="truncate text-foreground/90">{item.text}</span>
          </div>
        </Row>
      );
    }
    case "usage": {
      const u = item.usage;
      return (
        <Row ts={item.ts} className="py-0.5">
          <div className="num flex flex-wrap items-center gap-x-2 text-[11px] text-muted-foreground/80">
            <Zap className="size-3 text-muted-foreground/60" />
            <span>{u?.model}</span>
            <span>
              +{formatTokens(u?.input_tokens)} in / +{formatTokens(u?.output_tokens)} out
            </span>
            <span>{formatUsd(u?.cost_usd)}</span>
            {typeof u?.cumulative_cost_usd === "number" ? <span className="text-muted-foreground/60">Σ {formatUsd(u.cumulative_cost_usd)}</span> : null}
          </div>
        </Row>
      );
    }
    case "finding": {
      const f = item.finding;
      if (!f) return null;
      const last = f.verification_attempts?.length ? f.verification_attempts[f.verification_attempts.length - 1] : null;
      return (
        <Row ts={item.ts} highlight="finding">
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <Bug className="size-3.5 text-danger" />
              <span className="text-xs font-medium text-danger">{item.change === "created" ? "New finding" : "Finding updated"}</span>
              <span className="font-mono text-[11px] text-muted-foreground">{f.id}</span>
              <SeverityBadge severity={f.severity} />
              <FindingStatusChip status={f.status} />
              {item.agent ? <AgentBadge agent={item.agent} className="ml-auto" /> : null}
            </div>
            <div className="font-medium text-foreground">{f.title}</div>
            {item.change === "updated" && last ? (
              <div className="text-xs text-muted-foreground">
                Attempt {last.attempt}: {last.outcome.replace("_", " ")} · {last.notes}
              </div>
            ) : (
              <div className="text-xs text-muted-foreground">{f.feature}</div>
            )}
          </div>
        </Row>
      );
    }
    case "test": {
      const t = item.test;
      if (!t) return null;
      const r = t.last_result;
      return (
        <Row ts={item.ts} highlight="test">
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <FlaskConical className="size-3.5 text-signal" />
              <span className="text-xs font-medium text-signal">
                {item.change === "saved" ? "Test saved" : item.change === "exported" ? "Test exported to pull request" : "Test result"}
              </span>
              {item.change === "exported" && t.pr_url ? (
                <a
                  href={t.pr_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 font-mono text-[11px] text-signal underline-offset-4 hover:underline"
                >
                  {prLabel(t.pr_url)} <ExternalLink className="size-3" />
                </a>
              ) : null}
              <span className="font-mono text-[11px] text-muted-foreground">{t.finding_id}</span>
              {r ? <TestStatusChip status={r.status} /> : null}
              {r?.reproduces_bug ? (
                <span className="inline-flex h-[22px] items-center rounded-full border border-signal/40 bg-signal/8 px-2 text-[11px] font-medium text-signal">
                  Reproduces bug
                </span>
              ) : null}
              {r ? <span className="num text-[11px] text-muted-foreground">{formatMs(r.duration_ms)}</span> : null}
            </div>
            <div className="truncate font-mono text-xs text-foreground/90">{t.path}</div>
          </div>
        </Row>
      );
    }
    case "todo": {
      const done = item.todos?.filter((t) => t.status === "completed").length ?? 0;
      const total = item.todos?.length ?? 0;
      const current = item.todos?.find((t) => t.status === "in_progress");
      return (
        <Row ts={item.ts}>
          <div className="flex flex-wrap items-center gap-2 text-muted-foreground">
            <ListTodo className="size-3.5 text-info" />
            <span className="text-xs">
              Plan updated · {done}/{total} complete
            </span>
            {current ? <span className="truncate text-xs text-foreground/80">→ {current.content}</span> : null}
          </div>
        </Row>
      );
    }
    case "report":
      return (
        <Row ts={item.ts}>
          <div className="flex items-center gap-2">
            <FileText className="size-3.5 text-foreground" />
            <span className="text-foreground/90">Final report ready</span>
            <AgentBadge agent={item.agent} />
          </div>
        </Row>
      );
    default:
      return (
        <Row ts={item.ts}>
          <span className="font-mono text-xs text-muted-foreground">{item.type}</span>
        </Row>
      );
  }
}

function ToolRow({ item }: { item: FeedItem }) {
  const [open, setOpen] = useState(false);
  const t = item.tool;
  if (!t) return null;
  const hasDetails = t.args !== undefined || t.resultPreview || t.error;
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="flex flex-wrap items-center gap-2">
        <AgentBadge agent={item.agent} />
        <CollapsibleTrigger asChild disabled={!hasDetails}>
          <button
            type="button"
            className={cn(
              "inline-flex h-[22px] items-center gap-1.5 rounded-sm border border-border bg-background px-1.5 font-mono text-[11px] text-foreground/90 transition-colors duration-150",
              hasDetails && "hover:bg-muted",
            )}
          >
            <Wrench className="size-3 text-muted-foreground" />
            {t.tool}
            {t.done ? (
              t.error ? (
                <CircleX className="size-3 text-danger" />
              ) : (
                <CircleCheck className="size-3 text-signal" />
              )
            ) : (
              <LoaderCircle className="size-3 animate-spin text-muted-foreground" />
            )}
            {hasDetails ? <ChevronRight className={cn("size-3 text-muted-foreground transition-transform duration-150", open && "rotate-90")} /> : null}
          </button>
        </CollapsibleTrigger>
        {!open && t.resultPreview ? <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{t.resultPreview}</span> : null}
        {!open && !t.done ? <span className="text-xs text-muted-foreground">running…</span> : null}
      </div>
      <CollapsibleContent>
        <div className="mt-2 grid gap-2 text-xs">
          {t.args !== undefined ? (
            <div>
              <div className="eyebrow mb-1">Args</div>
              <pre className="scroll-thin max-h-48 overflow-auto rounded-md border border-border bg-background p-2.5 font-mono text-[11px] leading-4 text-foreground/85">{safeJson(t.args)}</pre>
            </div>
          ) : null}
          {t.resultPreview ? (
            <div>
              <div className="eyebrow mb-1">Result</div>
              <pre className="scroll-thin max-h-48 overflow-auto rounded-md border border-border bg-background p-2.5 font-mono text-[11px] leading-4 whitespace-pre-wrap text-foreground/85">
                {t.resultPreview}
              </pre>
            </div>
          ) : null}
          {t.error ? (
            <div>
              <div className="eyebrow mb-1 text-danger">Error</div>
              <pre className="scroll-thin max-h-48 overflow-auto rounded-md border border-danger/30 bg-danger/5 p-2.5 font-mono text-[11px] leading-4 whitespace-pre-wrap text-danger">
                {t.error}
              </pre>
            </div>
          ) : null}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
