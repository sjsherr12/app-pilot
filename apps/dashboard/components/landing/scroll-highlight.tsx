"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * A paragraph whose words brighten one by one as the reader scrolls past it.
 * Progress runs from the block entering the lower third of the viewport to it leaving the upper third.
 */
export function ScrollHighlight({ text, className }: { text: string; className?: string }) {
  const ref = useRef<HTMLParagraphElement | null>(null);
  const words = useMemo(() => text.split(/\s+/).filter(Boolean), [text]);
  const [lit, setLit] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight;
      const start = vh * 0.78; // top of block reaches here: 0 words lit
      const end = vh * 0.28; // bottom of block reaches here: all lit
      const p = (start - rect.top) / (rect.height + (start - end));
      const clamped = Math.max(0, Math.min(1, p));
      setLit(Math.round(clamped * words.length));
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [words.length]);

  return (
    <p ref={ref} className={cn("text-balance", className)}>
      {words.map((w, i) => (
        <span key={`${w}-${i}`} className={cn("hl-word", i < lit && "is-on")}>
          {w}
          {i < words.length - 1 ? " " : ""}
        </span>
      ))}
    </p>
  );
}
