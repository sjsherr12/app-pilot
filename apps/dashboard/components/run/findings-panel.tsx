"use client";

import { Bug, Download, FlaskConical, Lightbulb, ShieldCheck } from "lucide-react";
import type { Finding, TestCase } from "@/lib/api";
import { artifactUrl } from "@/lib/api";
import { formatClock } from "@/lib/format";
import { SEVERITY_ORDER } from "@/lib/status";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { FindingStatusChip, OutcomeChip, SeverityBadge } from "@/components/chips";
import { EmptyState } from "./panel";

export function FindingsPanel({
  findings,
  tests,
  active,
  onOpenShot,
}: {
  findings: Finding[];
  tests: Record<string, TestCase>;
  active: boolean;
  onOpenShot: (src: string | null | undefined, title: string) => void;
}) {
  if (findings.length === 0) {
    return (
      <EmptyState
        icon={<Bug className={cn(active && "animate-pulse")} />}
        title={active ? "No findings yet. The explorer is still probing the app." : "No findings were reported"}
      />
    );
  }
  const sorted = [...findings].sort(
    (a, b) => (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9) || a.created_at.localeCompare(b.created_at),
  );
  const testList = Object.values(tests);
  return (
    <div className="grid gap-5 p-5 xl:grid-cols-2">
      {sorted.map((f) => (
        <FindingCard
          key={f.id}
          finding={f}
          test={(f.test_id ? tests[f.test_id] : undefined) ?? testList.find((t) => t.finding_id === f.id)}
          onOpenShot={onOpenShot}
        />
      ))}
    </div>
  );
}

function Thumb({ src, title, onOpenShot }: { src: string | null; title: string; onOpenShot: (src: string | null, title: string) => void }) {
  if (!src) return null;
  return (
    <button
      type="button"
      onClick={() => onOpenShot(src, title)}
      className="group relative h-20 w-32 shrink-0 overflow-hidden rounded-md border border-border bg-background transition-colors duration-150 hover:border-[#34414d]"
      title={title}
    >
      <img src={src} alt={title} className="h-full w-full object-cover object-top transition-transform duration-200 group-hover:scale-[1.03]" loading="lazy" />
    </button>
  );
}

function SectionLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("eyebrow mb-2 flex items-center gap-1.5", className)}>{children}</div>;
}

function FindingCard({
  finding: f,
  test,
  onOpenShot,
}: {
  finding: Finding;
  test?: TestCase;
  onOpenShot: (src: string | null | undefined, title: string) => void;
}) {
  const video = artifactUrl(f.video_url);
  const trace = artifactUrl(f.trace_url);
  return (
    <article className="feed-in flex flex-col gap-5 rounded-lg border border-border bg-background p-5">
      <header className="flex flex-col gap-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs text-muted-foreground">{f.id}</span>
          <SeverityBadge severity={f.severity} />
          <FindingStatusChip status={f.status} />
          <span className="inline-flex h-[22px] items-center rounded-full border border-border px-2 text-[11px] text-muted-foreground">{f.feature}</span>
          <span className="eyebrow ml-auto normal-case tracking-normal">updated {formatClock(f.updated_at)}</span>
        </div>
        <h3 className="text-[15px] font-semibold leading-snug tracking-[-0.01em]">{f.title}</h3>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="border-l-2 border-l-signal pl-3">
          <SectionLabel className="text-signal">Expected</SectionLabel>
          <p className="text-sm leading-6 text-foreground/90">{f.expected}</p>
        </div>
        <div className="border-l-2 border-l-danger pl-3">
          <SectionLabel className="text-danger">Actual</SectionLabel>
          <p className="text-sm leading-6 text-foreground/90">{f.actual}</p>
        </div>
      </div>

      {f.repro_steps?.length ? (
        <div>
          <SectionLabel>Steps to reproduce</SectionLabel>
          <ol className="grid gap-1.5 text-sm">
            {f.repro_steps.map((s, i) => (
              <li key={i} className="flex gap-3">
                <span className="num mt-px grid size-5 shrink-0 place-items-center rounded-full border border-border text-[11px] text-muted-foreground">{i + 1}</span>
                <span className="leading-6 text-foreground/90">{s}</span>
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      {f.evidence_urls?.length ? (
        <div>
          <SectionLabel>Evidence</SectionLabel>
          <div className="scroll-thin flex gap-2 overflow-x-auto pb-1">
            {f.evidence_urls.map((u, i) => (
              <Thumb key={`${u}-${i}`} src={artifactUrl(u)} title={`${f.id} · evidence ${i + 1}`} onOpenShot={onOpenShot} />
            ))}
          </div>
        </div>
      ) : null}

      {video || trace ? (
        <div className="flex flex-wrap items-start gap-3">
          {video ? <video controls preload="metadata" src={video} className="max-h-64 w-full max-w-md rounded-md border border-border bg-black" /> : null}
          {trace ? (
            <Button asChild size="sm" variant="outline">
              <a href={trace} download>
                <Download /> Download trace
              </a>
            </Button>
          ) : null}
        </div>
      ) : null}

      {f.verification_attempts?.length ? (
        <div>
          <SectionLabel>
            <ShieldCheck className="size-3" /> Verification attempts
          </SectionLabel>
          <ul className="grid gap-2">
            {f.verification_attempts.map((a) => (
              <li key={a.attempt} className="flex flex-col gap-2 rounded-md border border-border bg-card p-3">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-mono text-xs text-muted-foreground">#{a.attempt}</span>
                  <OutcomeChip outcome={a.outcome} />
                  <span className="leading-6 text-foreground/85">{a.notes}</span>
                </div>
                {a.shot_urls?.length ? (
                  <div className="scroll-thin flex gap-2 overflow-x-auto">
                    {a.shot_urls.map((u, i) => (
                      <Thumb key={`${u}-${i}`} src={artifactUrl(u)} title={`${f.id} · attempt ${a.attempt} · shot ${i + 1}`} onOpenShot={onOpenShot} />
                    ))}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Not verified yet.</p>
      )}

      {f.root_cause ? (
        <div className="border-l-2 border-l-warn pl-3">
          <SectionLabel className="text-warn">
            <Lightbulb className="size-3" /> Root cause hypothesis
          </SectionLabel>
          <p className="text-sm leading-6 text-foreground/90">{f.root_cause}</p>
        </div>
      ) : null}

      {test || f.test_id ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <FlaskConical className="size-3.5 text-signal" />
          Regression test
          <span className="font-mono text-foreground/85">{test?.path ?? f.test_id}</span>
        </div>
      ) : null}
    </article>
  );
}
