"use client";

import { useEffect, useRef, useState, type CSSProperties, type ElementType, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/** True once the element has entered the viewport (and stays true, so entrances play once). */
export function useInView<T extends HTMLElement>(options?: IntersectionObserverInit & { once?: boolean }) {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);
  const { once = true, root = null, rootMargin = "0px 0px -10% 0px", threshold = 0.15 } = options ?? {};

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setInView(true);
            if (once) io.unobserve(entry.target);
          } else if (!once) {
            setInView(false);
          }
        }
      },
      { root, rootMargin, threshold },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [once, root, rootMargin, threshold]);

  return { ref, inView };
}

/** Scroll-triggered entrance: fades and rises 14px once, with an optional stagger delay. */
export function Reveal({
  as: Tag = "div",
  delay = 0,
  className,
  children,
  style,
  ...rest
}: {
  as?: ElementType;
  delay?: number;
  className?: string;
  children?: ReactNode;
  style?: CSSProperties;
  id?: string;
}) {
  const { ref, inView } = useInView<HTMLElement>();
  return (
    <Tag
      ref={ref}
      className={cn("reveal", inView && "is-in", className)}
      style={{ ...style, "--reveal-delay": `${delay}ms` } as CSSProperties}
      {...rest}
    >
      {children}
    </Tag>
  );
}

function easeOutExpo(t: number) {
  return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

/** A number that counts up from 0 when it scrolls into view. */
export function CountUp({
  value,
  decimals = 0,
  prefix = "",
  suffix = "",
  duration = 1400,
  className,
}: {
  value: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  duration?: number;
  className?: string;
}) {
  const { ref, inView } = useInView<HTMLSpanElement>({ threshold: 0.6 });
  const [shown, setShown] = useState(0);

  useEffect(() => {
    if (!inView) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      const id = requestAnimationFrame(() => setShown(value));
      return () => cancelAnimationFrame(id);
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      setShown(value * easeOutExpo(p));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, value, duration]);

  return (
    <span ref={ref} className={cn("num", className)}>
      {prefix}
      {shown.toFixed(decimals)}
      {suffix}
    </span>
  );
}
