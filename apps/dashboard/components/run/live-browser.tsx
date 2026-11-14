"use client";

import { useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowLeft,
  Camera,
  ChevronDown,
  Eraser,
  Globe,
  Keyboard,
  Lock,
  Maximize2,
  Monitor,
  MousePointerClick,
  RefreshCw,
  Scan,
  type LucideIcon,
} from "lucide-react";
import type { BrowserActionKind } from "@/lib/api";
import { artifactUrl } from "@/lib/api";
import { formatClock } from "@/lib/format";
import { AGENT, styleFor } from "@/lib/status";
import { cn } from "@/lib/utils";
import type { SessionShot } from "@/hooks/useRunEvents";
import { Button } from "@/components/ui/button";
import { Panel, EmptyState } from "./panel";

export const KIND_ICON: Record<BrowserActionKind, LucideIcon> = {
  navigate: Globe,
  click: MousePointerClick,
  type: Keyboard,
  select: ChevronDown,
  press: Keyboard,
  scroll: ArrowDown,
  back: ArrowLeft,
  reload: RefreshCw,
  reset: Eraser,
  snapshot: Scan,
  screenshot: Camera,
};

export function LiveBrowser({
  shots,
  sessionOrder,
  lastSession,
  active,
  onOpenShot,
  className,
}: {
  shots: Record<string, SessionShot>;
  sessionOrder: string[];
  lastSession: string | null;
  active: boolean;
  onOpenShot: (src: string | null | undefined, title: string) => void;
  className?: string;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [follow, setFollow] = useState(true);

  // Follow the most recently active session unless the user picked one.
  const current = useMemo(() => {
    if (follow) return lastSession ?? sessionOrder[0] ?? null;
    if (selected && shots[selected]) return selected;
    return lastSession ?? sessionOrder[0] ?? null;
  }, [follow, lastSession, selected, sessionOrder, shots]);

  const shot = current ? shots[current] : undefined;
  const src = artifactUrl(shot?.shotUrl);
  const Icon = shot ? (KIND_ICON[shot.kind] ?? Globe) : Globe;

  return (
    <Panel
      title="Live browser"
      icon={<Monitor />}
      className={className}
      actions={
        <>
          {sessionOrder.length > 0 ? (
            <span className="eyebrow">
              {sessionOrder.length} session{sessionOrder.length === 1 ? "" : "s"}
            </span>
          ) : null}
          <Button
            size="xs"
            variant="outline"
            className={cn(follow && "border-signal/40 text-foreground")}
            onClick={() => {
              // Leaving follow mode keeps the session currently on screen.
              if (follow) setSelected(current);
              setFollow(!follow);
            }}
            title="Automatically switch to the session that acted last"
          >
            <span className={cn("size-1.5 rounded-full", follow ? "bg-signal" : "bg-slate")} />
            Follow latest
          </Button>
        </>
      }
      bodyClassName="flex flex-col"
    >
      {sessionOrder.length > 0 ? (
        <div className="scroll-thin flex shrink-0 gap-1 overflow-x-auto border-b border-border px-3 py-2">
          {sessionOrder.map((s) => {
            const info = shots[s];
            const agentStyle = styleFor(AGENT, info?.agent ?? "system");
            const isActive = s === current;
            const isLive = active && s === lastSession;
            return (
              <button
                key={s}
                type="button"
                onClick={() => {
                  setSelected(s);
                  setFollow(false);
                }}
                className={cn(
                  "flex h-7 shrink-0 items-center gap-2 rounded-md border px-2.5 font-mono text-xs transition-colors duration-150",
                  isActive ? "border-border bg-background text-foreground" : "border-transparent text-muted-foreground hover:bg-background/60 hover:text-foreground",
                )}
              >
                <span className={cn("size-1.5 rounded-full", agentStyle.dot, isLive && "pulse-dot")} />
                {s}
                <span className="num text-[10px] text-muted-foreground">{info?.count ?? 0}</span>
              </button>
            );
          })}
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col p-4">
        {/* Browser frame */}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border border-border bg-background">
          <div className="flex h-9 shrink-0 items-center gap-2 border-b border-border px-3">
            <Lock className="size-3 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-foreground/85">{shot?.url || "about:blank"}</span>
            {shot ? <span className="eyebrow shrink-0 normal-case tracking-normal">{shot.shotUrl?.split("/").pop() ?? ""}</span> : null}
            <Button size="icon-xs" variant="ghost" disabled={!src} onClick={() => onOpenShot(src, `${shot?.session ?? ""} · ${shot?.caption ?? ""}`)} title="Open full size">
              <Maximize2 />
            </Button>
          </div>
          <div className="relative min-h-0 flex-1 bg-[#0a0e13]">
            {src ? (
              <button
                type="button"
                className="group absolute inset-0 flex items-center justify-center p-3"
                onClick={() => onOpenShot(src, `${shot?.session ?? ""} · ${shot?.caption ?? ""}`)}
                title="Open full size"
              >
                <img
                  key={src}
                  src={src}
                  alt={shot?.caption ?? "screenshot"}
                  className="shot-in max-h-full max-w-full rounded-sm border border-border object-contain transition-transform duration-200 group-hover:scale-[1.004]"
                />
              </button>
            ) : (
              <EmptyState
                icon={<Globe className={cn(active && "animate-pulse")} />}
                title={active ? "Waiting for the first browser action…" : "No browser activity recorded"}
                hint={active ? "Screenshots appear here as soon as an agent navigates." : undefined}
              />
            )}
          </div>
        </div>

        {/* Caption */}
        <div className="mt-3 flex h-6 shrink-0 items-center gap-2.5 text-xs">
          {shot ? (
            <>
              <span className="inline-flex h-[22px] items-center gap-1.5 rounded-full border border-border px-2 font-mono text-[11px] text-muted-foreground">
                <Icon className="size-3" />
                {shot.kind}
              </span>
              <span className="truncate text-foreground/90">{shot.caption}</span>
              <span className="num ml-auto shrink-0 text-muted-foreground">
                #{shot.count} · {formatClock(shot.ts)}
              </span>
            </>
          ) : (
            <span className="text-muted-foreground">The latest action is described here.</span>
          )}
        </div>
      </div>
    </Panel>
  );
}
