# AppPilot: judge prep

Everything you need in your head before you present. Read the first two sections aloud until they are yours; skim the Q&A once and keep it open on your phone.

---

## 1. The pitch

**One line.** QA that finds the bug, proves it in a clean environment, and hands you the failing test.

**Ten seconds.** AppPilot is an autonomous QA engineer. Point it at a web app, say what to test in plain English, and a team of AI agents explores the app in a real browser, reproduces every suspected bug from scratch before reporting it, and gives you a standard Playwright test that fails until the bug is fixed.

**Thirty seconds.** Writing code is no longer the bottleneck; proving it works is. Existing AI testers report whatever one agent saw once, so engineers stop trusting them. AppPilot treats a first observation as a rumour. A separate verifier agent gets a brand-new browser and a freshly reset backend, follows the repro steps literally, and only then is anything called a bug. Every confirmed finding comes with expected versus actual grounded in your product notes, numbered repro steps, screenshots, a video, a Playwright trace, and a regression test in plain `@playwright/test` that you can drop into any CI. On our demo shop with three planted bugs and one decoy, it found all three, reported zero false positives, and did it in 10.7 minutes for $4.81.

**The three things that make it different.** Say these in every conversation:

1. **Nothing is a bug until a second agent reproduces it in a clean environment.**
2. **Output is open.** Plain Playwright specs with `getByRole` locators. No proprietary format, no vendor runner.
3. **Transparent economics.** Tokens and dollars per agent stream live. You always know what a run cost.

---

## 2. How it works, in the order a judge will see it

### The cast

| Agent | Model | What it does | What it may touch |
|---|---|---|---|
| Supervisor | Claude Opus 5.5, effort high | Reads objective and product notes, maps the app, writes a risk-ordered todo list, delegates, merges duplicates, writes the final report. Never touches a browser. | `task`, `write_todos`, findings tools, `finalize_run` |
| Explorer (up to 2 in parallel) | Opus 5.5, effort medium | Exercises one feature area: happy path, then edge cases. Records *candidate* findings. | Its own browser session and server tenant, `record_candidate_finding` |
| Verifier (one per candidate) | Opus 5.5, effort medium | Resets its environment first, follows the repro steps literally, classifies the result. | A fresh browser context and freshly reset tenant, `update_finding` |
| Test writer (one per confirmed finding) | Opus 5.5, effort medium | Writes a Playwright spec from the verifier's action log, runs it, iterates until it fails on an assertion. | `get_action_log`, `save_regression_test`, `run_regression_test` |

### A run, step by step, using the real cart bug

1. **Start.** The user gives a URL, an objective ("Test this application and find any broken functionality"), optional product notes, and a test login.
2. **Recon.** The supervisor sends one explorer to map the app: pages, flows, controls. The map lands in a shared workspace file.
3. **Plan.** The supervisor writes 4 to 8 todos, prioritized money, persistence, navigation first. Judges see them appear in the Plan tab.
4. **Explore.** An explorer navigates to the shop, adds a Canvas Tote Bag, opens the cart, clicks "Increase quantity" twice. It reads the line total with `read_text`, does the arithmetic itself (3 × $18.50 should be $55.50), sees $18.50, and checks the product notes, which say line total equals unit price times quantity. It records **candidate** F001 with exact steps naming controls by role and accessible name, plus screenshot ids.
5. **Verify.** The supervisor hands only the finding id to a verifier. The verifier calls `reset_environment`: new browser context, no cookies, and a freshly reset server tenant. It repeats the steps, reads $18.50 again, confirms the values survive a reload, and marks F001 **confirmed** with its own screenshots. If the first attempt had disagreed with the explorer, it would reset and try once more, then mark it flaky or inconclusive.
6. **Prove.** The test writer pulls the verifier's action log, writes a spec with `getByRole('button', { name: 'Increase quantity for Canvas Tote Bag' })`, asserts the expected $55.50, and runs it. It fails on `expect(...)`: "Expected 0, received 1" for the $24.49 total. That is the definition of a reproducing test. A locator timeout would not count.
7. **Report.** The supervisor writes the final report: findings table, coverage, what was *not* tested, limitations. The run shows tokens and cost in the header.
8. **Fix it live.** Toggle the seeded bug off, click Run again, the same test goes green in about a second. Click Export to PR and a pull request opens with the bug report as its body and a CI workflow that runs the spec.

### The engine underneath (for technical judges)

- **Browser.** Python 3.13 and Playwright. One Chromium process, one isolated context per agent session. After every action a script is injected that tags visible interactive elements with refs and returns a compact text snapshot: URL, headings, trimmed text, `[e12] button "Add to cart"`, new console errors, failed requests, and a screenshot id. Refs regenerate on every snapshot so the model cannot act on stale state.
- **Action log.** Every click and keystroke is recorded with role and accessible name. That log is what makes the generated tests use `getByRole` instead of CSS.
- **Isolation.** The demo shop namespaces server state by a tenant cookie. Explorers and verifiers each get their own tenant, and the verifier resets its tenant through a test hook before it starts.
- **Guardrails.** Navigation outside the target origin is blocked at the network layer. Each session has a 150-action budget, the run has a wall-clock budget, and the graph has a recursion limit.
- **Agents.** LangChain DeepAgents: the supervisor delegates with a `task` tool, tracks progress with `write_todos`, and shares a workspace backend. Subagents are declared with their own tools and prompts. The verifier returns typed structured output. Findings and tests are written only through dedicated tools, so every status change is an event.
- **Evidence.** Verifier sessions record video and a Playwright trace you can open in the trace viewer.
- **Plumbing.** FastAPI streams events over server-sent events. A file-backed store under `data/runs/<id>/` holds everything. A callback handler attributes every LLM and tool call to the right agent and prices tokens live. LangSmith traces the full tree.
- **Dashboard.** Next.js, Tailwind, shadcn. The live view and the replay are the same code path reading the same event stream.
- **CI and PR.** Generated specs are a plain Playwright project. GitHub Actions starts the shop with every bug switched off and runs the specs as a regression guard. PR export commits the spec in a throwaway worktree, pushes, and calls `gh pr create`. Your checkout is never touched.

---

## 3. Numbers to have ready

Best rehearsal run (`run_6b4c9ec9`, broad prompt, product notes attached, no hint where the bugs were):

| Metric | Result |
|---|---|
| Seeded bugs found and confirmed | 3 of 3 |
| False positives | 0. The decoy coupon was never reported |
| Candidates that did not reproduce | 1 (F004), correctly marked inconclusive after two clean attempts |
| Regression tests generated | 3, all failing on an `expect()` that states the bug |
| Duration | 10.7 min |
| Cost | $4.81 (6.5M input tokens, mostly prompt-cache reads; 57k output) |
| Screenshots captured | 262 |

Earlier run for contrast: 18.7 min, $7.59, 3 of 3 bugs, but 5 candidates because parallel explorers filed duplicates. Fixing that is a real engineering story (see Q&A).

Cart-only run for a live demo: 3.9 min, $1.02, bug found, verified, and covered by a reproducing test.

Model pricing you may be asked about: Opus 5.5 is $4 per million input tokens and $20 per million output tokens. Prompt caching is why a 6.5M-token run costs under $5.

---

## 4. The seeded bugs and the decoy

| Flag | Bug | Why it is a good test of a QA agent |
|---|---|---|
| `cart_quantity_total` | Lines with quantity ≥ 3 total as quantity 1 | Needs edge-case exploration and arithmetic, not just clicking |
| `profile_name_not_persisted` | Account page shows "Saved" but the display name is thrown away | Only visible after reload or re-login |
| `first_order_link_404` | "View order" on the confirmation page points at order n-1, so a first order 404s | Deterministic trigger with a programmatic signal |
| Decoy: `WELCOME10` | Coupon works only on a first order, with an inline message saying so, and it is documented | A tester that reports surprising-but-correct behaviour fails this |

The agents were never told where or how many. The objective was the generic sentence above.

---

## 5. Demo plan (3 minutes)

Follow `docs/demo-script.md`. The beats, with the one line to say at each:

1. **Shop** at `localhost:3001`. "A normal store. It has three bugs. We did not tell AppPilot where."
2. **Start the run** from the dashboard. For a run that finishes on stage use the cart-only prompt from the demo script, and keep the full-run replay open in another tab for breadth.
3. **Plan tab.** "It read the product docs and planned by risk: money, persistence, navigation first."
4. **First finding card.** "Notice it says *candidate*. AppPilot never reports what one agent saw once."
5. **Verifier resets.** "Fresh browser, cookies gone, freshly reset backend. It reproduces from the steps, not from memory." Card flips to *confirmed*.
6. **Tests tab.** "Standard Playwright, role-based locators, and it fails on an assertion that states the bug, not on a timeout."
7. **Fix it live.** Toggle the flag, Run again, green. "Same test, fixed build."
8. **Export to PR.** "Review it like a teammate's PR. Your checkout was never touched."
9. **Header and Report.** "Here is what it cost, and here is what it did not test."

Before you walk up: `make preflight`. If it is yellow, read the warnings. If it is red, fix the red lines.

If something breaks: switch to the replay tab; the same dashboard renders the recorded run. If the shop misbehaves, reset the tenant with the curl in the demo script. If the API crashed, `make api` again; finished runs still replay from disk.

---

## 6. Questions judges will ask, and your answers

### "Why not just ask ChatGPT or Claude to test my app?"

A chat model cannot click. Even a chat model with a browser tool gives you one agent's single pass: it clicks around, forms an opinion, and writes a paragraph. You get no reproduction, no evidence, no test, no cost control, and no way to tell a real bug from a misread screen. AppPilot is the harness around the model: an engine that gives the model clean, structured observations and logs every action; a second, skeptical agent that must reproduce from a clean state before anything is reported; grounding rules that tie "expected" to your product notes; and a pipeline that turns the finding into a standard test and a PR. The model is one component. The trust comes from the system.

### "Doesn't AI already do this when it writes code?"

Coding agents write tests for the code they just wrote, from the same understanding that produced the code. They share its blind spots. If the agent believed quantity handling was fine, its unit test believes it too. AppPilot is black-box testing of the running product in a real browser, by agents that did not write the code, that read the product spec instead of the implementation, and that must reproduce a failure independently. Those are the two things a good human QA engineer adds and a coding agent structurally cannot: an outside view, and verification.

### "Isn't this just the Playwright MCP server plus an LLM?"

The Playwright MCP server gives one model one browser. We wrote our own engine because the design needs things MCP does not give you: several isolated browser contexts at once, one per agent; a server-side tenant reset so the verifier's environment is truly clean; an action log with roles and accessible names that the test writer turns into stable locators; an origin guard; per-session action budgets; and screenshots, video, and traces wired into the event stream. The agent layer, the verification protocol, the findings model, the dashboard, the CI guard, and the PR export are all ours.

### "How do you stop it from hallucinating bugs?"

Three layers. First, grounding: an explorer may only record a candidate when behaviour contradicts the product notes, an explicit UI contract (a "Saved" message implies persistence; a subtotal implies arithmetic), or a programmatic signal (404, console error, failed request). Documented or explained behaviour is never a bug. Second, independence: the verifier receives only the finding id, never the explorer's opinion, resets its environment, and must observe the contradiction itself. Third, honesty in the output: anything that does not reproduce is marked potential, flaky, or inconclusive and stays out of the confirmed list. In our best run the decoy coupon was never reported, and one candidate that did not reproduce in two clean attempts was correctly marked inconclusive.

### "How do you know the generated tests are any good?"

A test only counts as reproducing the bug if it fails on an `expect()` assertion. A locator timeout, a thrown error, or a pass means the test is wrong and the writer iterates, up to three times. Locators come from the action log as `getByRole` with accessible names, never CSS classes or generated ids. And we prove it on stage: the same test fails on the buggy build and passes the moment the bug is switched off. The CI workflow runs those specs against the fixed build on every push, so they are a real regression guard, not a demo artifact.

### "What about flaky tests?"

Tests run with zero retries and one worker, and every spec starts from a clean tenant via a `beforeEach` snippet, so the test itself is deterministic. On the finding side, flakiness is a first-class status: if the verifier's first attempt disagrees with the explorer, it resets and tries once more, and a disagreement between attempts is reported as flaky rather than confirmed.

### "How is this different from Momentic or the other AI testing startups?"

They are good products and they validate the market. The differences we built on purpose: a mandatory independent reproduction before anything is reported; open output in plain Playwright instead of a proprietary test format you can only run on their platform; and cost shown live per agent. Everything here runs locally from a clone of the repo, and the architecture has a platform-adapter seam for mobile.

### "Didn't you plant the bugs yourselves? Isn't that rigged?"

Yes, we planted them; that is how you measure a QA tool, the same way security teams seed vulnerabilities. What matters is what the agents were told: a URL, the generic objective "find any broken functionality", and the product notes. No hints about where, what kind, or how many. We also planted a decoy that is surprising but correct and documented, which is the trap most AI testers fall into. The engine is application-agnostic: it reads the accessibility tree of whatever page it is on.

### "Does it work on a real app, not just your demo shop?"

Honest answer: the demo shop is where we have measured it, and the full fresh-environment reset depends on the target exposing a reset hook or disposable test accounts, which our shop does. The browser side is universal: every verifier already gets a brand-new browser context against any URL. For a production app you would point it at a staging environment with a test account, exactly as you would for any end-to-end test suite. Making the backend reset pluggable is the first roadmap item after mobile.

### "Why multiple agents instead of one big agent?"

Four reasons. Context: an explorer that has clicked for twenty minutes carries a huge, biased context; a verifier that starts cold cannot be led by it. Skepticism: separating "noticed" from "confirmed" into different agents with different prompts is what makes verification independent. Parallelism: two explorers in isolated sessions cut our run time from 18.7 to 10.7 minutes. Structure: each handoff is a typed object (a finding, a verification result, a test result), not a paragraph.

### "Why DeepAgents and LangChain?"

DeepAgents gives us the supervisor pattern out of the box: a `task` tool for delegation, `write_todos` for a visible plan, declarative subagents with their own tools and prompts, and a shared file backend for the app map. LangChain callbacks are how we attribute every token and tool call to the right agent for the live cost view, and LangSmith gives a full trace of the supervisor, explorer, verifier, test-writer tree for debugging.

### "Why Claude Opus 5.5 for everything?"

The agents' job is judgment: deciding whether $18.50 contradicts the product notes, writing repro steps a stranger can follow, interpreting a Playwright failure. That is where the strongest model pays for itself, and adaptive thinking with effort control lets us spend more on the supervisor and less on workers. Prompt caching makes it affordable: most of a run's 6.5 million input tokens are cache reads, which is why it costs under $5. Every role can be pointed at a different model with one environment variable, so swapping a cheaper model into exploration is a config change.

### "What does a run cost and how long does it take? Does it scale?"

$4.81 and 10.7 minutes for a full pass over a six-feature app; about $1 and 4 minutes for a single feature. Explorers run in parallel; verification and test writing are sequential per finding. The budgets (actions per session, wall clock, recursion limit) are explicit and enforced by the engine, not the prompt, so a run cannot run away.

### "Is it safe to let an agent loose on an app?"

The engine blocks navigation to any origin other than the target at the network layer. Agents are told never to perform real purchases or destructive actions beyond test data, and in practice you run it against staging with a test account. It will submit forms inside the target, which is the point, so test only environments you own.

### "What was the hardest part?"

Making "fresh environment" real rather than a slogan: a new browser context is easy, a clean backend is not, so we built per-tenant server state and a reset hook. Then the parallel-explorer duplicate problem: our first full run confirmed all three bugs but filed five candidates; we added de-duplication at the supervisor and per-invocation browser sessions, and the next run was clean and eight minutes faster. And getting the test writer to understand that a timeout is a broken test, not a reproduced bug.

### "What did you build versus use off the shelf?"

Used: Playwright, LangChain DeepAgents, Claude, Next.js, Tailwind, shadcn, FastAPI, LangSmith, the GitHub CLI. Built: the browser engine and snapshot system, every tool, the four agent prompts and the verification protocol, the findings and test data model, the event bus and run store, the API, the dashboard, the demo shop with its tenant isolation and bug flags, the CI regression guard, the PR export, and the scoring script.

### "Did you use AI to build it?"

Answer truthfully; judges respect it and usually ask. A good framing: "Yes. We used Claude Code as a pair programmer throughout, which is part of the thesis. Code is cheap to produce now, so the scarce thing is proof that it works. That is what AppPilot sells."

### "Is the replay on the landing page real?"

Yes. Every screenshot was captured by AppPilot during `run_6b4c9ec9`. The replay is a scripted, time-compressed walk through that run's real event log, not a mock-up. The finding text, the test, and the assertion error on the page are copied from the run verbatim.

### "What are the limitations?"

Say them before they do. Passing tests do not prove an app is bug-free; coverage is what the report says it is. Findings marked potential, flaky, or inconclusive are exactly that. Web only today. The backend reset is a hook the target has to provide. And a run costs real money, so you would run it on pull requests or nightly, not on every keystroke.

### "What is next?"

iOS and Android through the same supervisor and dashboard, using Mobile MCP to drive simulators and Maestro for generated flows; the engine already sits behind a platform-adapter boundary. A GitHub App that runs on every pull request and posts a required check. Persistent app knowledge across runs. Self-healing locators that propose a diff a human approves. Hosted execution so teams share runs, evidence, and cost.

### "Who pays for this?"

Teams shipping faster than they can test: small engineering teams with no QA function, and larger ones whose end-to-end suites rot. Pricing follows the cost model that is already on screen: per run, with the dollar figure visible, plus a seat for the dashboard and CI integration.

---

## 7. Things not to claim

- Do not say it finds "all" bugs. Say it found all three seeded bugs with zero false positives on this app.
- Do not say it has been run on production apps. Say the engine is app-agnostic and it has been measured on the demo shop.
- Do not say mobile works. Say the adapter boundary exists and mobile is next.
- Do not say tests are self-healing. Say that is on the roadmap, with human approval.
- Do not quote a cost without the duration, or a duration without the cost. They are the honest pair.

---

## 8. Vocabulary, in case a judge uses a term you are not sure of

- **Candidate / confirmed / potential / flaky / env_failure / inconclusive.** The finding statuses. Only confirmed findings are reported as bugs.
- **Fresh environment.** New browser context (no cookies or storage) plus a freshly reset server-side tenant.
- **Accessible role and name.** How screen readers see a control: `button "Add to cart"`. Stable across restyles, which is why the tests use them.
- **Playwright trace.** A recording of every action, DOM snapshot, and network call in a session, opened with the Playwright trace viewer.
- **Prompt caching.** Reusing the unchanged prefix of a prompt across calls at a fraction of the price. Why long agent runs are affordable.
- **SSE.** Server-sent events: the one-way stream the API uses to push events to the dashboard.
- **DeepAgents.** LangChain's framework for supervisor-and-subagent systems with planning, delegation, and a shared file workspace.
