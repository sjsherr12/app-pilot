"use client";

import { useEffect, useRef, useState } from "react";
import { GitPullRequest, LoaderCircle, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Reveal } from "./motion";

const SPEC = `import { test, expect } from "@playwright/test";

test("Cart line total equals unit price × quantity at quantity 3", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Add Canvas Tote Bag to cart" }).click();
  await page.getByRole("link", { name: "Cart (1)" }).click();

  const increase = page.getByRole("button", { name: "Increase quantity for Canvas Tote Bag" });
  await increase.click();
  await increase.click();
  await expect(page.getByRole("link", { name: "Cart (3)" })).toBeVisible();

  // 3 × $18.50 = $55.50, so the $24.49 total must not exist.
  await expect(page.getByText("$24.49", { exact: true })).toHaveCount(0);
  await expect(page.getByText("$55.50", { exact: true }).first()).toBeVisible();
});`;

type Result = "idle" | "running" | "failed" | "passed";

/** The fix-it-live beat: flip the seeded bug off, re-run the generated test, watch it go green. */
export function TestProof() {
  const [bugOn, setBugOn] = useState(true);
  const [result, setResult] = useState<Result>("failed");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const run = (on: boolean) => {
    if (timer.current) clearTimeout(timer.current);
    setResult("running");
    timer.current = setTimeout(() => setResult(on ? "failed" : "passed"), on ? 1400 : 1000);
  };

  const toggle = (next: boolean) => {
    setBugOn(next);
    run(next);
  };

  return (
    <section id="regression" className="border-b border-border bg-card/30">
      <div className="mx-auto w-full max-w-[1400px] px-5 py-24 sm:px-8">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16 [&>*]:min-w-0">
          <div className="flex flex-col justify-center">
            <Reveal>
              <p className="eyebrow">Regression tests</p>
              <h2 className="heading mt-3 text-[30px] leading-[1.1] sm:text-[36px]">Fails on the bug. Passes on the fix. Runs anywhere.</h2>
              <p className="mt-4 text-[15.5px] leading-7 text-muted-foreground">
                AppPilot writes the test from the verifier’s own action log, then runs it to prove it fails on an{" "}
                <code className="rounded bg-muted px-1 py-0.5 text-[13px]">expect()</code> that states the bug, never on a timeout. Flip the
                seeded bug off and run it again.
              </p>
            </Reveal>

            <Reveal delay={100} className="surface mt-8 p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-[14px] font-medium">Seeded bug · cart_quantity_total</p>
                  <p className="mt-1 text-[12.5px] text-muted-foreground">Lines with quantity ≥ 3 contribute price × 1 instead of price × quantity.</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn("eyebrow transition-colors duration-150", bugOn ? "text-danger" : "text-signal")}>{bugOn ? "on" : "fixed"}</span>
                  <Switch checked={bugOn} onCheckedChange={toggle} aria-label="Toggle the seeded bug" />
                </div>
              </div>
              <div className="mt-5 flex items-center gap-3">
                <Button size="sm" variant="outline" onClick={() => run(bugOn)} disabled={result === "running"}>
                  {result === "running" ? <LoaderCircle className="animate-spin" /> : <Play />}
                  Run again
                </Button>
                <span className="text-xs text-muted-foreground">Same spec, same locators, no edits.</span>
              </div>
            </Reveal>

            <Reveal delay={160} className="mt-6 flex flex-wrap items-center gap-3 text-[13px] text-muted-foreground">
              <GitPullRequest className="size-4 text-signal" />
              <span>
                One click exports the spec to a branch and opens a pull request with the bug report as its body. Your checkout is never touched.
              </span>
            </Reveal>
          </div>

          <Reveal delay={120} className="surface overflow-hidden">
            <div className="flex h-11 items-center gap-3 border-b border-border px-4">
              <span className="font-mono text-[12px]">tests/run_6b4c9ec9/F001.spec.ts</span>
              <span className="eyebrow ml-auto">@playwright/test</span>
            </div>
            <pre className="scroll-thin overflow-x-auto p-4 font-mono text-[11.5px] leading-[1.65] text-muted-foreground">
              {SPEC.split("\n").map((l, i) => (
                <div
                  key={i}
                  className={cn("whitespace-pre", l.includes("expect(") && "text-foreground", l.trim().startsWith("//") && "text-slate/80")}
                >
                  {l || " "}
                </div>
              ))}
            </pre>
            <div className="border-t border-border bg-background">
              <div className="flex h-10 items-center gap-2 border-b border-border px-4">
                <span className="eyebrow">npx playwright test</span>
                <span className="eyebrow ml-auto hidden sm:inline">APP_URL=http://localhost:3001</span>
              </div>
              <div className="min-h-[108px] p-4 font-mono text-[12px] leading-6" aria-live="polite">
                {result === "running" ? (
                  <p className="inline-flex items-center gap-2 text-muted-foreground">
                    <LoaderCircle className="size-3.5 animate-spin" /> Running 1 test using 1 worker…
                  </p>
                ) : result === "failed" ? (
                  <div className="rise-in">
                    <p className="text-danger">✘ 1 failed · F001.spec.ts:40 · 11.3 s</p>
                    <p className="mt-1 text-muted-foreground">
                      Error: expect(locator).toHaveCount(expected) failed
                      <br />
                      Locator: getByText(&apos;$24.49&apos;, {"{"} exact: true {"}"}) · Expected: 0 · Received: 1
                    </p>
                    <p className="mt-2 inline-flex items-center gap-2 text-signal">
                      <span className="size-1.5 rounded-full bg-signal" /> Reproduces bug: failed on an assertion, not a timeout
                    </p>
                  </div>
                ) : (
                  <div className="rise-in">
                    <p className="text-signal">✔ 1 passed · 1.1 s</p>
                    <p className="mt-1 text-muted-foreground">Same test, fixed build, green. Commit it and the bug cannot come back unnoticed.</p>
                  </div>
                )}
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
