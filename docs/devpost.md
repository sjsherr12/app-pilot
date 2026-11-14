# AppPilot - Agentic QA Engineer

## Inspiration

Writing code stopped being the bottleneck this year. Proving it works did not. Every team we know ships faster than it can test, and the AI "bug bash" tools that have appeared to fill the gap share one weakness: they report whatever a single agent saw once. A hallucinated bug costs an engineer an hour; a dozen of them and the tool gets switched off.

We wanted a QA engineer that behaves the way a good human one does. It reads the product notes before it starts. It treats its own first observation as a rumour. It reproduces the bug from scratch, in a clean environment, before it says anything. And when it does speak up, it hands you something you can act on today: exact repro steps, a recording, and a failing test in a format your CI already understands.

That became the one-line pitch: **QA that finds the bug, proves it in a clean environment, and hands you the failing test.**

## What it does

You point AppPilot at a web app, say what you want tested in plain English, and optionally paste your product notes and a test login. A team of four Claude agents, coordinated with LangChain's DeepAgents, then does the work of a QA engineer:

1. **Plan.** A supervisor reads the objective and product notes, maps the app, and writes a risk-ordered test plan (money, persistence, navigation first).
2. **Explore.** Explorer agents drive a real Chromium browser through Playwright: happy paths first, then edge cases like quantity 3, reload after save, repeat actions. Anything suspicious is recorded as a *candidate*, never a bug.
3. **Verify.** A separate verifier agent gets a brand-new browser context and a freshly reset server-side tenant. It follows the candidate's repro steps literally and classifies the result: confirmed, potential, flaky, environment failure, or inconclusive. Only confirmed findings are reported.
4. **Prove.** A test-writer agent turns the verifier's own action log into a standard `@playwright/test` spec with `getByRole` locators, runs it, and iterates until the failure is an `expect()` assertion that states the bug rather than a timeout.

Every confirmed finding is a case file: expected versus actual grounded in the product notes, numbered repro steps, a screenshot sequence, a video of the verification session, and a Playwright trace. One click exports the spec to a branch and opens a pull request with the bug report as its body.

A live dashboard streams all of it as it happens: the agents' browser screenshots, the plan, every tool call, each finding changing state, the generated tests, and the running token cost. Every event is persisted, so a finished run replays from the same stream.

## How we built it

**Target app.** We built a small Next.js e-commerce shop ("Northstar Goods") and planted three bugs behind runtime flags: cart lines at quantity 3 or more total as quantity 1, the account page shows "Saved" but never persists the display name, and the "View order" link on a first order 404s. We also planted a decoy: a coupon that correctly works only on a first order, documented in the product notes, to catch any tester that reports surprising-but-correct behaviour. Server state is namespaced per tenant via a cookie, so an explorer and a verifier can hit one server without seeing each other's carts.

**Browser engine.** Python 3.13 and Playwright. Each agent gets its own isolated browser context. After every action we inject a script that collects the visible interactive elements, tags them with stable refs, and returns a compact text snapshot (URL, headings, trimmed text, `[e12] button "Add to cart"`, new console errors, failed requests) plus a screenshot id. Every action is logged with its role and accessible name, which is what lets the test writer emit `getByRole` specs instead of brittle CSS. Verifier sessions also record video and a Playwright trace.

**Agents.** DeepAgents with Claude Opus 5.5 for every role, adaptive thinking on, high effort for the supervisor and medium for the workers. Subagents are declared with their own tools and prompts; the verifier returns a typed Pydantic result so the supervisor gets structured JSON back. Findings and tests are written through dedicated tools, never free-form files, so every status change is an event.

**API and dashboard.** FastAPI streams events over server-sent events to a Next.js dashboard built with Tailwind and shadcn. A file-backed run store under `data/runs/<id>/` holds the run, the event log, findings, tests, screenshots, videos and traces. A LangChain callback handler attributes every LLM call and tool call to the right agent and prices the tokens live. LangSmith traces the whole supervisor, explorer, verifier, test-writer tree.

**CI and PR export.** Generated specs land in a plain Playwright project. A GitHub Actions workflow builds the shop with every seeded bug switched off and runs the specs, so the suite AppPilot wrote on Friday is the regression guard on Saturday. The PR export creates a branch in a throwaway worktree, commits the spec with the bug report as the message, pushes, and calls `gh pr create`. Your checkout is never touched.

## Challenges we ran into

**Making "fresh environment" real, not a slogan.** A new browser context is easy; a clean backend is not. Per-tenant server state plus a reset hook the verifier calls first was the answer, and it is what lets explorers and verifiers run in parallel against one server.

**Duplicate findings from parallel explorers.** Our first full rehearsal run confirmed all three bugs but recorded five candidates, because two explorers working different feature areas both tripped over the same cart bug. We added candidate de-duplication and per-invocation browser sessions, and the second run came back with three findings, no duplicates, in 10.7 minutes instead of 18.7.

**Tests that fail for the wrong reason.** Early generated specs "reproduced" bugs by timing out on a locator that no longer existed. We made the runner distinguish an `expect()` assertion failure from a timeout and only count the former as reproducing the bug, then put that rule in the test writer's prompt and let it iterate up to three times.

**Attributing events to agents.** LangChain callbacks see a tree of run ids, not agent names. We track which `task` call spawned which subtree so every tool call, screenshot and dollar on the dashboard lands under the right badge.

**Stale element refs.** Refs are regenerated on every snapshot, so a model that acts on a remembered ref after navigation would click the wrong thing. Every action now returns a fresh snapshot, and tools re-snapshot and retry once before erroring.

## Accomplishments that we're proud of

On the broad prompt "Test this application and find any broken functionality", with the product notes attached and no hint about where the bugs were, our best rehearsal run:

| Metric | Result |
|---|---|
| Seeded bugs found and confirmed | 3 of 3 |
| False positives | 0 (the decoy coupon was never reported) |
| Candidate that did not reproduce | 1, correctly marked *inconclusive* after two clean attempts |
| Generated regression tests | 3, all failing on an `expect()` that states the bug |
| Duration | 10.7 minutes |
| Cost | $4.81, with most input tokens served from the prompt cache |

Flip the cart bug off and re-run the generated test: it goes green in about a second. Flip it back on: it fails again on the same assertion. That fail-then-pass beat, plus the PR that opens with the full bug report, is the demo.

We are also proud that the final report says what was *not* tested and what the limitations are, next to the findings table. An honest QA engineer tells you about coverage, not just bugs.

## What we learned

- **Verification is the product.** The explorer finds candidates easily; the trust comes from the second agent that has to reproduce them from a clean state. Separating "noticed" from "confirmed" changed how every other component was designed.
- **Ground truth beats cleverness.** Giving the agents product notes and requiring every expected behaviour to cite them, an explicit UI contract, or a programmatic signal is what kept the decoy out of the report.
- **Deterministic engine, intelligent coordination.** Letting tools do the clicking, measuring, resetting and budgeting, and letting the models decide what to try, made runs both cheaper and far more repeatable.
- **Prompt caching is not optional for agents.** Long-running multi-agent runs are almost all repeated context. With caching the cost of a full run dropped to a few dollars.
- **Persist everything.** Because every event is written to disk, the live dashboard and the replay are the same code path, which also gave us a safety net for the demo.

## What's next for AppPilot - Agentic QA Engineer

- **iOS and Android.** The engine sits behind a platform adapter boundary. Mobile MCP for driving simulators and Maestro for generated flows reuse the same supervisor, verifier and dashboard.
- **GitHub App.** Run on every pull request and post results as a required check, instead of exporting one PR at a time.
- **Persistent app knowledge.** Remember the app map, login flow and past findings across runs so each run starts smarter and cheaper.
- **Self-healing tests with a paper trail.** When a locator breaks on a legitimate UI change, propose the fix as a diff a human approves, never a silent edit.
- **Hosted execution.** Run the browsers and agents in the cloud so a team can share runs, evidence and cost.
