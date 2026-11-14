import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProductDemo } from "./product-demo";
import { REPO_URL } from "./site-nav";
import { Reveal } from "./motion";

const HEADLINE: Array<{ word: string; key?: boolean; br?: boolean }> = [
  { word: "Ship" },
  { word: "with" },
  { word: "proof,", key: true, br: true },
  { word: "not" },
  { word: "hope." },
];

export function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-border" id="product">
      <div className="grid-paper pointer-events-none absolute inset-0" aria-hidden />
      <div className="hero-glow pointer-events-none absolute inset-x-0 top-0 h-[70vh]" aria-hidden />

      <div className="relative mx-auto flex w-full max-w-[1400px] flex-col items-center px-5 pt-20 pb-12 text-center sm:px-8 lg:pt-28">
        <p className="word-in eyebrow inline-flex items-center gap-2 rounded-full border border-border bg-background/70 px-3 py-1.5 backdrop-blur-sm" style={{ "--d": "0ms" } as React.CSSProperties}>
          <span className="pulse-dot size-1.5 rounded-full bg-signal" />
          Autonomous QA engineer · web today, iOS and Android next
        </p>

        <h1 className="display mt-7 text-[46px] leading-[1.02] sm:text-[64px] lg:text-[84px]">
          {HEADLINE.map((w, i) => (
            <span key={w.word}>
              <span className="word-in relative" style={{ "--d": `${120 + i * 70}ms` } as React.CSSProperties}>
                {w.word}
                {w.key ? (
                  <span
                    aria-hidden
                    className="draw-x absolute inset-x-0 -bottom-1 h-[3px] rounded-full bg-signal sm:-bottom-1.5 sm:h-1"
                    style={{ "--d": "700ms" } as React.CSSProperties}
                  />
                ) : null}
              </span>
              {w.br ? <br /> : " "}
            </span>
          ))}
        </h1>

        <p
          className="word-in mt-7 max-w-2xl text-[17px] leading-7 text-muted-foreground sm:text-[19px] sm:leading-8"
          style={{ "--d": "520ms" } as React.CSSProperties}
        >
          AppPilot explores your application like a careful tester, reproduces every suspected bug in a clean environment
          before reporting it, and hands you a standard Playwright test that fails until the bug is fixed.
        </p>

        <div className="word-in mt-9 flex flex-wrap items-center justify-center gap-3" style={{ "--d": "640ms" } as React.CSSProperties}>
          <Button asChild size="lg">
            <Link href="/runs#new-run">
              Start a run <ArrowRight />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <a href={REPO_URL} target="_blank" rel="noreferrer">
              View source <ArrowUpRight />
            </a>
          </Button>
        </div>

        <p className="word-in mt-5 text-xs text-muted-foreground" style={{ "--d": "760ms" } as React.CSSProperties}>
          No proprietary test format. Runs against localhost or any URL you can reach.
        </p>
      </div>

      <Reveal className="relative mx-auto w-full max-w-[1200px] px-3 pb-20 sm:px-8" delay={200}>
        <ProductDemo />
        <p className="mt-4 text-center text-xs text-muted-foreground">
          A compressed replay of a real run. Every screenshot was captured by AppPilot against the Northstar Goods demo shop.
        </p>
      </Reveal>
    </section>
  );
}
