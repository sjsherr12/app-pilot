"use client";

import { useCallback, useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

export interface ShotDialogState {
  src: string | null;
  title: string;
  open: boolean;
}

export function useShotDialog() {
  const [state, setState] = useState<ShotDialogState>({ src: null, title: "", open: false });
  const open = useCallback((src: string | null | undefined, title: string) => {
    if (!src) return;
    setState({ src, title, open: true });
  }, []);
  const onOpenChange = useCallback((o: boolean) => setState((s) => ({ ...s, open: o })), []);
  return { ...state, open: state.open, show: open, onOpenChange };
}

export function ShotDialog({ src, title, open, onOpenChange }: ShotDialogState & { onOpenChange: (o: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="w-auto max-w-[min(96vw,1700px)] gap-2 rounded-lg border border-border bg-background p-2 shadow-none sm:max-w-[min(96vw,1700px)]"
        aria-describedby={undefined}
      >
        <DialogTitle className="sr-only">{title || "Screenshot"}</DialogTitle>
        {src ? <img src={src} alt={title} className="max-h-[86vh] w-auto max-w-full rounded-md object-contain" /> : null}
        <p className="eyebrow truncate px-1 pb-1 normal-case tracking-normal">{title}</p>
      </DialogContent>
    </Dialog>
  );
}
