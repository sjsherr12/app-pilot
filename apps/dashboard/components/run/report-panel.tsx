"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { EmptyState } from "./panel";

export function ReportPanel({ markdown, active }: { markdown: string | null; active: boolean }) {
  if (!markdown) {
    return (
      <EmptyState
        icon={<FileText className={cn(active && "animate-pulse")} />}
        title={active ? "The supervisor writes the final report when the run completes." : "No report was produced"}
      />
    );
  }
  return (
    <div className="p-5 sm:p-8">
      <article
        className={cn(
          "prose prose-invert prose-sm max-w-3xl",
          "prose-headings:font-semibold prose-headings:tracking-[-0.02em] prose-headings:text-foreground prose-h1:text-2xl prose-h2:mt-10 prose-h2:text-lg prose-h3:text-base",
          "prose-p:leading-7 prose-p:text-foreground/85 prose-a:text-signal prose-a:no-underline hover:prose-a:underline prose-strong:text-foreground prose-li:text-foreground/85",
          "prose-code:rounded prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:font-normal prose-code:text-foreground prose-code:before:content-none prose-code:after:content-none",
          "prose-pre:rounded-md prose-pre:border prose-pre:border-border prose-pre:bg-background",
          "prose-table:text-xs prose-th:font-mono prose-th:text-[11px] prose-th:font-medium prose-th:uppercase prose-th:tracking-[0.06em] prose-th:text-muted-foreground prose-td:align-top prose-tr:border-border prose-thead:border-border",
          "prose-li:my-0.5 prose-hr:border-border",
        )}
      >
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
      </article>
    </div>
  );
}
