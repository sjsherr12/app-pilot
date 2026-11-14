# AppPilot demo script (HackPrinceton)

Target length: 3 minutes live, plus a 2 minute recorded backup.

## Before the demo

1. Start the three servers (`make shop`, `make api`, `make dash`) and open `http://localhost:3000`.
2. Reset every seeded bug to ON so the shop is in its "buggy" state:
   ```bash
   curl -X POST localhost:3001/__test/bugs -H 'content-type: application/json' -d '{"cart_quantity_total":true,"profile_name_not_persisted":true,"first_order_link_404":true}'
   ```
3. Have the replay of the best recorded run open in a second tab (`/runs/<recorded run id>`) as the fallback.
4. Have a terminal ready with the fix command from step "Fix it live".
5. For the "Ship the test" beat: `gh auth status` must be green, and close any rehearsal PR so the live click opens a fresh one:
   `gh pr close <n> --delete-branch && git branch -D apppilot/F001-<run short id>`.

## The pitch in one line

"QA that finds the bug, proves it in a clean environment, and hands you the failing test."

## Beats

**0:00 The target.** Flip to the shop at `localhost:3001`. "A normal-looking store: catalog, cart, coupons, checkout, orders, account. It has three bugs. We did not tell AppPilot where."

**0:20 Start the run.** Dashboard, New run: URL `http://localhost:3001`, objective "Test this application and find any broken functionality.", product notes pasted from `docs/demo-shop-product-notes.md`, demo credentials. Start.

**0:40 Plan.** Point at the Plan tab as `write_todos` lands: "The supervisor read the product docs and planned by risk: money, persistence, navigation first." Left pane: the explorer's live screenshots as it clicks.

**1:20 Candidate, not bug.** When the first finding card appears: "Notice it says *candidate*. AppPilot never reports what one agent saw once."

**1:40 Independent verification.** Feed shows `reset_environment` on the verifier: "Fresh browser context, cookies gone, and a freshly reset server-side tenant. It reproduces from the repro steps, not from memory." Card flips to *confirmed* with screenshots, video, and a Playwright trace.

**2:10 The failing test.** Tests tab: the generated `@playwright/test` spec, `getByRole` locators, and the run result badge "Reproduces bug" with the assertion message ("Expected $55.50, received $18.50"). "Standard Playwright. No proprietary format. Drop it in CI."

**2:30 Fix it live.** In the terminal:
```bash
curl -X POST localhost:3001/__test/bugs -H 'content-type: application/json' -d '{"cart_quantity_total":false}'
```
Click "Run again" on that test. It passes. "Same test, fixed build, green."

**2:40 Ship the test.** Still on the Tests tab, click "Export to PR" on the same card. A spinner, then a green `PR #n` link appears: AppPilot created branch `apppilot/F001-<run short id>` from `HEAD` in a throwaway worktree, committed the spec with the bug report as the commit message, pushed, and opened the pull request through `gh`. Click the link: the PR body is the bug report (expected, actual, numbered repro steps, evidence shot ids, the test result) and the regression workflow runs the new spec in CI. "Review it like any teammate's PR. Your checkout was never touched." Clicking again reuses the branch and the open PR, so this is safe to rehearse.

**2:50 Economics and honesty.** Header: tokens and cost for the run. Report tab: coverage and limitations spelled out. If asked: LangSmith trace of supervisor, explorer, verifier, test writer.

## If something goes wrong

- Run slow or stuck: switch to the replay tab; the same dashboard renders the recorded run from its persisted event stream.
- Shop misbehaving: `curl -X POST 'localhost:3001/__test/reset?tenant=default'`.
- API crashed: `make api` again; finished runs still replay from disk.

## Numbers to have ready

Rehearsal run 1 (`run_edb28c48`, 2026-11-14, broad prompt, product notes attached):

| Metric | Result |
|---|---|
| Duration | 18.7 min |
| Cost | $7.59 (11.8M input tokens, 98% cache reads; 74k output) |
| Seeded bugs found and confirmed | 3 of 3 (cart quantity, order link off-by-one, display name not saved) |
| Decoy (WELCOME10) reported as a bug | No |
| Candidates recorded | 5 (two pairs were duplicates filed by parallel explorers; the report says so) |
| Confirmed findings matching a seeded bug | 5 of 5 (precision 100%) |
| Generated regression tests | 5, all failing on an `expect()` assertion that states the bug |
| Fix-it-live | cart flag off: F001 test passes in about 1 s; flag on: fails again on the assertion |

Rehearsal run 2 (`run_6b4c9ec9`, same prompt, with per-invocation browser sessions and candidate dedup):

| Metric | Result |
|---|---|
| Duration | 10.7 min (parallel explorers in isolated sessions) |
| Cost | $4.81 (6.5M input tokens, mostly cache reads; 57k output) |
| Seeded bugs found and confirmed | 3 of 3, no duplicates |
| Extra candidate | F004 (marketing opt-out) was NOT reproduced in two clean attempts and was marked inconclusive: the false-positive guard in action |
| Generated regression tests | 3, all failing on an `expect()` assertion that states the bug |

Replay fallback: `http://localhost:3000/runs/run_6b4c9ec9` (preferred; run 1 at `/runs/run_edb28c48` also works). Events, screenshots, videos and traces are on disk under `data/runs/<run_id>`.

Live-on-stage option: a cart-only run (`run_f366720a`) finished in 3.9 min for $1.02 with the quantity bug found, verified, and covered by a reproducing test. Start one at the top of the pitch with:

```bash
python3 scripts/start-run.py "Test the shopping cart only: line totals, subtotal, shipping threshold, and quantities of 3 or more. Skip recon; one explorer task is enough. Verify any candidate and write a regression test for each confirmed finding, then finalize."
```

It usually reaches a confirmed finding by minute 2 and a failing regression test by minute 3, while the full-run replay shows breadth.

Score any run with `python3 scripts/score-run.py <run_id>`.
