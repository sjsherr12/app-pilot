import Link from "next/link";
import { ArrowRight, ArrowUpRight, Bug, CheckCheck, Eye, FlaskConical, Microscope, Receipt, ShieldCheck, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Mark } from "@/components/brand/logo";
import { LatestRun } from "./latest-run";

const REPO_URL = "https://github.com/sjsherr12/app-pilot";

export function Landing() {
  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border">
        <div className="grid-paper pointer-events-none absolute inset-0" aria-hidden />
        <div className="relative mx-auto grid w-full max-w-[1800px] gap-14 px-5 pt-16 pb-16 sm:px-8 lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)] lg:gap-16 lg:pt-24 lg:pb-24">
          <div className="flex flex-col justify-center">
            <p className="eyebrow">Autonomous QA for modern software</p>
            <h1 className="display mt-6 text-[44px] leading-[1.02] sm:text-[56px] lg:text-[64px]">
              Ship with proof,
              <br />
              not hope.
            </h1>
            <p className="mt-6 max-w-xl text-[17px] leading-7 text-muted-foreground">
              Autonomous AI quality assurance for modern software. Explore applications, discover and reproduce
              bugs, and generate reliable regression tests across web and mobile.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button asChild size="lg">
                <Link href="/runs">
                  Open console <ArrowRight />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/runs#new-run">Start a run</Link>
              </Button>
            </div>
            <dl className="mt-12 grid max-w-xl grid-cols-3 gap-6 border-t border-border pt-6">
              <Stat label="Seeded bugs confirmed" value="3 / 3" />
              <Stat label="False positives" value="0" />
              <Stat label="Full run" value="10.7 min" />
            </dl>
            <p className="mt-3 text-xs text-muted-foreground">Rehearsal against the Northstar Goods demo shop, with every finding independently reproduced.</p>
          </div>
          <div className="relative flex items-center lg:justify-end">
            <LatestRun />
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto w-full max-w-[1800px] px-5 py-20 sm:px-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="eyebrow">How it works</p>
            <h2 className="heading mt-3 text-[28px] leading-tight sm:text-[32px]">Observe. Investigate. Verify.</h2>
          </div>
          <p className="max-w-md text-sm leading-6 text-muted-foreground">
            A supervisor plans the work; specialised agents explore, reproduce, and write tests. Nothing is reported
            until it has been reproduced from a clean state.
          </p>
        </div>
        <ol className="mt-10 grid gap-px overflow-hidden rounded-lg border border-border bg-border md:grid-cols-3">
          <Step
            n="01"
            title="Observe"
            icon={Eye}
            text="Explore the app the way a careful tester would: every flow and edge case, with screenshots, console errors and failed requests captured along the way."
          />
          <Step
            n="02"
            title="Investigate"
            icon={Microscope}
            text="Suspected bugs are only candidates. A separate verifier resets the environment, opens a fresh browser, and follows the repro steps to the letter."
          />
          <Step
            n="03"
            title="Verify"
            icon={CheckCheck}
            text="Confirmed bugs ship with evidence and a standard Playwright test that fails on the bug and passes once it is fixed. Drop it straight into CI."
          />
        </ol>
      </section>

      {/* What you get */}
      <section className="border-t border-border bg-card/40">
        <div className="mx-auto w-full max-w-[1800px] px-5 py-20 sm:px-8">
          <p className="eyebrow">What you get</p>
          <h2 className="heading mt-3 max-w-2xl text-[28px] leading-tight sm:text-[32px]">Trusted evidence, not a wall of alerts.</h2>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            <Feature
              icon={ShieldCheck}
              title="Independent verification"
              text="Every candidate is reproduced in a fresh browser context against a reset tenant before it is called a bug. Candidates that do not reproduce are marked, not reported."
            />
            <Feature
              icon={Bug}
              title="Bug reports that stand up"
              text="Expected versus actual grounded in your product notes, exact repro steps named by accessible role, screenshots, video and a Playwright trace."
            />
            <Feature
              icon={FlaskConical}
              title="Standard regression tests"
              text="Plain @playwright/test specs with getByRole locators. No proprietary format, runnable in any CI, generated to fail on the bug."
            />
            <Feature
              icon={Receipt}
              title="Transparent economics"
              text="Tokens and cost per agent stream to the dashboard live. You always know what a run cost and where the time went."
            />
          </div>
        </div>
      </section>

      {/* Closing */}
      <section className="border-t border-border">
        <div className="mx-auto flex w-full max-w-[1800px] flex-col gap-10 px-5 py-20 sm:px-8 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Mark className="h-8 w-auto text-foreground" />
            <h2 className="display mt-6 text-[40px] leading-[1.05] sm:text-[48px]">
              Test everything.
              <br />
              Trust what ships.
            </h2>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href="/runs">
                Open console <ArrowRight />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <a href={REPO_URL} target="_blank" rel="noreferrer">
                GitHub <ArrowUpRight />
              </a>
            </Button>
          </div>
        </div>
        <footer className="border-t border-border">
          <div className="mx-auto flex w-full max-w-[1800px] flex-wrap items-center justify-between gap-4 px-5 py-6 sm:px-8">
            <span className="eyebrow">AppPilot / Autonomous QA engineer</span>
            <span className="eyebrow">Web today · iOS and Android next</span>
          </div>
        </footer>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <dd className="num text-2xl font-medium tracking-[-0.02em] text-foreground">{value}</dd>
      <dt className="eyebrow">{label}</dt>
    </div>
  );
}

function Step({ n, title, icon: Icon, text }: { n: string; title: string; icon: LucideIcon; text: string }) {
  return (
    <li className="flex flex-col gap-6 bg-background p-8">
      <div className="flex items-center justify-between">
        <span className="eyebrow">{n}</span>
        <Icon className="size-5 text-muted-foreground" strokeWidth={1.5} />
      </div>
      <div>
        <h3 className="text-xl font-semibold tracking-[-0.02em]">{title}</h3>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p>
      </div>
    </li>
  );
}

function Feature({ icon: Icon, title, text }: { icon: LucideIcon; title: string; text: string }) {
  return (
    <div className="surface flex flex-col gap-5 p-6">
      <span className="grid size-9 place-items-center rounded-md border border-border bg-background text-foreground">
        <Icon className="size-[18px]" strokeWidth={1.5} />
      </span>
      <div>
        <h3 className="text-base font-semibold tracking-[-0.01em]">{title}</h3>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p>
      </div>
    </div>
  );
}
