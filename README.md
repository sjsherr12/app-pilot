# AppPilot

**The autonomous AI QA engineer.** Point AppPilot at a web app, say what to test, and a team of
DeepAgents-coordinated agents plans the testing, drives a real Chromium browser, records candidate
bugs, independently re-verifies each one in a fresh environment, and emits standard Playwright
regression tests that fail while the bug exists and pass once it is fixed. A live dashboard shows
every agent, action, screenshot, finding, and dollar as it happens.

*Ship faster. Break less.*

## What happens in a run

```
objective ──> supervisor plans (write_todos)
               ├─ explorer   : drives browser session "explore", records CANDIDATE findings
               ├─ verifier   : fresh browser context + reset tenant, reproduces, classifies
               │               confirmed / potential / flaky / env_failure / inconclusive
               └─ test_writer: writes @playwright/test spec, runs it, iterates until the
                               failure is an expect() assertion that states the bug
             ──> final report (markdown) + evidence (screenshots, video, Playwright trace)
```

Design rules that make it trustworthy:

- **Deterministic engine, intelligent coordination.** Tools click, measure, reset, and enforce budgets. Models decide what to try and how to interpret results.
- **Nothing is a bug until it is reproduced.** Every candidate goes to a separate verifier agent that starts from a brand-new browser context and a freshly reset server-side tenant.
- **Open output.** Regression tests are plain `@playwright/test` specs with `getByRole`/`getByLabel` locators, runnable in any CI.
- **Transparent economics.** Token usage and cost per agent stream to the dashboard live.
- **Everything is replayable.** Every event is persisted; a finished run replays from the same stream the live view uses.

## Repository layout

```
apps/api                  Python 3.13: Playwright engine, DeepAgents graph, FastAPI + SSE
apps/dashboard            Next.js live dashboard (port 3000)
apps/demo-shop            Next.js demo shop with seeded bugs and runtime bug flags (port 3001)
packages/regression-tests @playwright/test project where generated specs land
docs/                     product brief, demo-shop product notes, demo script
data/runs/<run_id>/       run.json, events.jsonl, findings/, tests/, shots/, video/, traces/, workspace/
```

## Running locally

Prerequisites: Node 20+, [uv](https://docs.astral.sh/uv/), an Anthropic API key, optionally a LangSmith key.

```bash
cp .env.example .env            # fill in ANTHROPIC_API_KEY (and LANGSMITH_* for traces)
make install                    # uv sync + Playwright Chromium + npm installs
```

Then in three terminals:

```bash
make shop                       # demo shop on http://localhost:3001 (test hooks enabled)
```

```bash
make api                        # FastAPI on http://localhost:8000
```

```bash
make dash                       # dashboard on http://localhost:3000
```

Useful while developing:

```bash
make status                     # which of ports 3000/3001/3002/8000 are in use, and by what
```

```bash
make stop                       # stop whatever is listening on those ports
```

```bash
make dash DASH_PORT=3002        # dashboard on another port
```

Start a run from the dashboard, or with curl:

```bash
curl -X POST localhost:8000/api/runs -H 'content-type: application/json' -d '{"app_url":"http://localhost:3001","objective":"Test this application and find any broken functionality.","credentials":{"username":"demo@apppilot.dev","password":"demo1234"}}'
```

Watch it at `http://localhost:3000/runs/<id>`.

## The demo shop

`apps/demo-shop` is a small e-commerce app whose server state is namespaced per tenant (cookie
`apx_tenant`), so an explorer and a verifier can run against one server without interfering. With
`APX_TEST_HOOKS=1` it exposes `POST /__test/reset?tenant=X` and `GET|POST /__test/bugs`. Three bugs
are seeded behind runtime flags (cart subtotal ignores quantity at 3+, display name is not persisted,
the first order's "View order" link 404s) plus one correct-but-surprising decoy (a first-order-only
coupon). Start the shop with `APX_BUGS_DEFAULT=off` to run it with every bug fixed (what CI does), or
flip a flag at runtime to watch a generated regression test go from failing to passing:

```bash
curl -X POST localhost:3001/__test/bugs -H 'content-type: application/json' -d '{"cart_quantity_total": false}'
```

## API

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/runs` | list runs |
| `POST` | `/api/runs` | create and start a run (`app_url`, `objective`, `product_notes?`, `credentials?`, `reset_hook?`) |
| `GET` | `/api/runs/{id}` | run, findings, tests |
| `GET` | `/api/runs/{id}/events` | Server-Sent Events: replays persisted events, then streams live |
| `POST` | `/api/runs/{id}/stop` | stop a run |
| `POST` | `/api/tests/{id}/run` | re-run a generated regression test |
| `POST` | `/api/tests/{id}/export` | push the spec to branch `apppilot/<finding_id>-<run short id>` and open a GitHub pull request |
| `GET` | `/artifacts/{run_id}/...` | screenshots, videos, traces |

Models: every agent defaults to `claude-opus-5-5` via `langchain-anthropic` (`APPPILOT_MODEL`), with
per-role overrides such as `APPPILOT_EXPLORER_MODEL` and effort via `APPPILOT_SUPERVISOR_EFFORT` /
`APPPILOT_WORKER_EFFORT`.

## Brand and dashboard design

The dashboard follows the AppPilot brand system: Geist Sans and Geist Mono, the Ink / Elevated / Border /
Chalk / Slate palette with Signal Green as the single accent, 8px cards, 6px buttons, 1px borders, and
150 to 250 ms transitions. Tokens live in `apps/dashboard/app/globals.css`; the landing page is `/` and the
console is `/runs`. Logo files are placeholders: see `apps/dashboard/public/brand/README.md` for exactly
which files to replace and at what size.

## Continuous integration

Generated specs are plain Playwright, so they run anywhere. `.github/workflows/regression.yml` builds the
demo shop with its seeded bugs switched off and runs every generated spec on each pull request: the suite
AppPilot wrote while hunting bugs becomes the regression guard for their fixes.

## Export a test as a pull request

Every test card in the dashboard's Tests tab has an **Export to PR** button (`POST /api/tests/{id}/export`).
AppPilot creates (or reuses) the branch `apppilot/<finding_id>-<run short id>`, for example
`apppilot/F001-6b4c9ec9`, from the current `HEAD` inside a temporary git worktree, so your checkout and
current branch are never touched. It copies the spec, adds `.github/workflows/regression.yml` if the branch
lacks it, commits with the finding's title, expected vs actual and repro steps (trailer
`Co-Authored-By: AppPilot <noreply@apppilot.dev>`), pushes with `git push -u origin`, and opens the pull
request with the `gh` CLI; the PR body is the bug report with evidence shot ids and the last test result,
ending in `🤖 Generated with AppPilot`. Exporting the same test again pushes to the same branch and returns the
existing PR. Requirements on the machine running the API: an `origin` remote on GitHub, at least one commit,
and `gh auth login`; without a remote the endpoint answers 400 with instructions.

Useful commands:

```bash
make run                        # start a full run against the shop (product notes + demo credentials)
```

```bash
python3 scripts/score-run.py <run_id>   # recall/precision against the seeded bugs, tests reproducing
```

```bash
make reset-bugs                 # turn every seeded bug back on before a demo
```

## Tests

```bash
make test                       # engine tests against a static fixture app, no model calls
```

## Limitations (stated plainly)

- Passing tests do not prove an application is bug-free; coverage is what the report says it is.
- Findings marked `potential`, `flaky`, or `inconclusive` are exactly that: not confirmed.
- Web only for now. iOS/Android (Mobile MCP + Maestro), GitHub PR checks, hosted execution, and
  self-healing tests are on the roadmap in `docs/product-brief.md`.
- Test only environments you own. The engine blocks navigation outside the target origin, but it
  will happily submit forms inside it.
