# AppPilot dashboard

Next.js 16 (App Router, TypeScript, Tailwind 4, shadcn/ui) dashboard for AppPilot runs.
Dark theme by default. Runs on port 3000.

## Run it

```bash
npm install
npm run dev          # against the real API at NEXT_PUBLIC_API_URL (default http://localhost:8000)
npm run dev:mock     # against the built-in mock API, no backend needed
```

`npm run build` and `npm run lint` must pass.

## Environment

| Variable              | Default                  | Meaning                                                      |
| --------------------- | ------------------------ | ------------------------------------------------------------ |
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000`  | Base URL of `apps/api`. Artifact paths are prefixed with it. |
| `NEXT_PUBLIC_MOCK`    | unset                    | `1` routes every call to `/api/mock/*` route handlers.       |

Both are `NEXT_PUBLIC_*`, so they are inlined at build time: restart `next dev` after changing them.

## Pages

- `/` — runs table (objective, app URL, status, created, cost; polls every 5s) and the **New run** form
  (`POST /api/runs`, then navigates to the run page).
- `/runs/[id]` — live run page. Loads `GET /api/runs/{id}` once, then opens an `EventSource` on
  `GET /api/runs/{id}/events` and reduces every event into state. The backend replays persisted events before
  streaming live ones, so finished runs replay through the same code. Reconnects with exponential backoff
  (1s → 15s) while the run is active; when the server closes the stream of a finished run the header shows
  "Replay complete".
  - Header: objective, status chip, elapsed timer (`started_at` → `finished_at`/now), tokens in/out, cost, Stop.
  - **Live browser**: one tab per `session` seen in `browser.action` events; latest screenshot per session,
    caption of the last action, "Follow latest" auto-switches to the session that acted last; click for full size.
  - **Agent feed**: agent badges, tool chips (expandable args / result), browser one-liners, `llm.usage` ticks,
    highlighted finding and test events. Auto-scroll with a pause toggle (scrolling up pauses it).
  - Tabs: **Plan** (latest `todo.update`), **Findings** (cards with expected/actual, repro steps, evidence
    gallery, video, trace download, verification attempts), **Tests** (code, last result, "Run again" →
    `POST /api/tests/{id}/run`), **Report** (`report.final` / `run.report_md` via react-markdown + GFM).

## Code map

- `lib/api.ts` — the API contract (types) and fetch helpers. `apiUrl()` / `artifactUrl()` resolve paths against
  `NEXT_PUBLIC_API_URL`, or against `/api/mock` in mock mode.
- `hooks/useRunEvents.ts` — the SSE reducer: run, findings by id, tests by id, todos, latest shot per session,
  feed items (tool.end merges into its tool.start by `call_id`), usage totals, report markdown, connection state.
- `components/run/*` — run page panels. `components/runs/runs-page.tsx` — list + form. `components/chips.tsx`
  and `lib/status.ts` — status/severity/agent colours.
- `app/api/mock/*` — mock backend with the same paths and shapes as the real API (`/api/mock/runs`,
  `/api/mock/runs/[id]`, `/api/mock/runs/[id]/events`, `/api/mock/runs/[id]/stop`, `/api/mock/tests/[id]/run`,
  `/api/mock/artifacts/...`). `lib/mock/fixture.ts` holds an 80-event run against the demo shop; the SSE route
  plays it at ~300ms per event the first time a run's stream is opened, and replays already-played events fast
  on reconnect. Screenshots are generated SVGs (`lib/mock/shots.ts`); the verification video is
  `public/mock/verify-F001.mp4`.
