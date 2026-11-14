import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Mark } from "@/components/brand/logo";
import { Reveal } from "./motion";
import { REPO_URL } from "./site-nav";

export function Closing() {
  return (
    <section className="relative overflow-hidden">
      <div className="grid-paper pointer-events-none absolute inset-0 opacity-70" aria-hidden />
      <div className="relative mx-auto flex w-full max-w-[1400px] flex-col items-center px-5 py-28 text-center sm:px-8">
        <Reveal>
          <Mark variant="signal" className="mx-auto h-10 w-auto" />
        </Reveal>
        <Reveal delay={80}>
          <h2 className="display mt-8 text-[40px] leading-[1.02] sm:text-[56px] lg:text-[64px]">
            Test everything.
            <br />
            Trust what ships.
          </h2>
        </Reveal>
        <Reveal delay={160}>
          <p className="mt-6 max-w-xl text-[16px] leading-7 text-muted-foreground">
            Point AppPilot at a URL, state what to test, and get back confirmed bugs with evidence and the tests that keep them fixed.
          </p>
        </Reveal>
        <Reveal delay={240} className="mt-9 flex flex-wrap justify-center gap-3">
          <Button asChild size="lg">
            <Link href="/runs#new-run">
              Start a run <ArrowRight />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <a href={REPO_URL} target="_blank" rel="noreferrer">
              GitHub <ArrowUpRight />
            </a>
          </Button>
        </Reveal>
      </div>
    </section>
  );
}
