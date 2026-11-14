import { cn } from "@/lib/utils";

export function Panel({
  title,
  icon,
  actions,
  children,
  className,
  bodyClassName,
}: {
  title: React.ReactNode;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn("surface flex min-h-0 flex-col overflow-hidden", className)}>
      <header className="flex h-11 shrink-0 items-center gap-2.5 border-b border-border px-4">
        {icon ? <span className="text-muted-foreground [&_svg]:size-4">{icon}</span> : null}
        <h2 className="text-[13px] font-medium">{title}</h2>
        <div className="ml-auto flex items-center gap-3">{actions}</div>
      </header>
      <div className={cn("min-h-0 flex-1", bodyClassName)}>{children}</div>
    </section>
  );
}

export function EmptyState({ icon, title, hint, className }: { icon?: React.ReactNode; title: string; hint?: string; className?: string }) {
  return (
    <div className={cn("flex h-full min-h-40 flex-col items-center justify-center gap-2.5 p-6 text-center", className)}>
      {icon ? <div className="text-muted-foreground/60 [&_svg]:size-6 [&_svg]:stroke-[1.5]">{icon}</div> : null}
      <p className="text-sm font-medium text-muted-foreground">{title}</p>
      {hint ? <p className="max-w-sm text-xs leading-5 text-muted-foreground/70">{hint}</p> : null}
    </div>
  );
}
