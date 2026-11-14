// Deterministic fixture: one realistic AppPilot run against the demo shop,
// expressed as the exact Event stream the backend would emit.

import type {
  AgentName,
  BrowserActionPayload,
  Finding,
  RunEvent,
  TestCase,
  Todo,
} from "@/lib/api";
import type { Scene } from "./shots";

export type FixtureVariant = "full" | "failed" | "stopped";

export const SHOP = "http://localhost:3001";

/** Every screenshot the fixture references, with the page it shows. */
export const SHOTS: Record<string, { scene: Scene; url: string }> = {
  s0001: { scene: "home", url: `${SHOP}/` },
  s0002: { scene: "catalog", url: `${SHOP}/collections/all` },
  s0003: { scene: "product", url: `${SHOP}/products/trail-runner-jacket` },
  s0004: { scene: "product_added", url: `${SHOP}/products/trail-runner-jacket` },
  s0005: { scene: "cart", url: `${SHOP}/cart` },
  s0006: { scene: "cart_negative", url: `${SHOP}/cart` },
  s0007: { scene: "cart_coupon_typed", url: `${SHOP}/cart` },
  s0008: { scene: "cart_coupon_once", url: `${SHOP}/cart` },
  s0009: { scene: "cart_coupon_twice", url: `${SHOP}/cart` },
  s0010: { scene: "search_empty", url: `${SHOP}/search?q=jacket%20` },
  s0011: { scene: "checkout", url: `${SHOP}/checkout` },
  s0012: { scene: "checkout_invalid", url: `${SHOP}/checkout` },
  s0013: { scene: "checkout_disabled", url: `${SHOP}/checkout` },
  s0014: { scene: "blank", url: "about:blank" },
  s0015: { scene: "product", url: `${SHOP}/products/trail-runner-jacket` },
  s0016: { scene: "product_added", url: `${SHOP}/products/trail-runner-jacket` },
  s0017: { scene: "cart", url: `${SHOP}/cart` },
  s0018: { scene: "cart_negative", url: `${SHOP}/cart` },
  s0019: { scene: "product", url: `${SHOP}/products/trail-runner-jacket` },
  s0020: { scene: "product_added", url: `${SHOP}/products/trail-runner-jacket` },
  s0021: { scene: "cart", url: `${SHOP}/cart` },
  s0022: { scene: "cart_coupon_typed", url: `${SHOP}/cart` },
  s0023: { scene: "cart_coupon_once", url: `${SHOP}/cart` },
  s0024: { scene: "cart_coupon_twice", url: `${SHOP}/cart` },
  s0025: { scene: "search_results", url: `${SHOP}/search?q=jacket%20` },
  s0026: { scene: "search_empty", url: `${SHOP}/search?q=jacket%20` },
  s0027: { scene: "error_502", url: `${SHOP}/checkout` },
  s0028: { scene: "unreachable", url: `${SHOP}/` },
};

const SUPERVISOR_MODEL = "claude-opus-5-5";
const WORKER_MODEL = "claude-sonnet-5-5";

export interface Fixture {
  events: RunEvent[];
  findings: Finding[];
  tests: TestCase[];
  reportMd: string;
}

const TODOS: Todo[] = [
  { content: "Explore the storefront: catalog, product page, cart, checkout", status: "pending" },
  { content: "Probe edge cases: quantities, coupons, search, form validation", status: "pending" },
  { content: "Verify each candidate finding in a fresh browser context", status: "pending" },
  { content: "Write Playwright regression tests for confirmed bugs", status: "pending" },
  { content: "Write the final QA report", status: "pending" },
];

function todos(statuses: Todo["status"][]): Todo[] {
  return TODOS.map((t, i) => ({ ...t, status: statuses[i] ?? "pending" }));
}

const F001_SPEC = `import { test, expect } from "@playwright/test";

// F001: cart accepts negative quantities and shows a negative total.
test("cart rejects negative quantities", async ({ page }) => {
  await page.goto("${SHOP}/products/trail-runner-jacket");
  await page.getByRole("button", { name: "Add to cart" }).click();
  await page.goto("${SHOP}/cart");

  const qty = page.getByRole("spinbutton", { name: "Quantity" });
  await qty.fill("-3");
  await qty.press("Enter");

  // The input must clamp to a positive quantity and the total must never go negative.
  await expect(qty).not.toHaveValue(/^-/);
  const total = await page.getByTestId("cart-total").textContent();
  expect(parseFloat((total ?? "0").replace(/[^0-9.-]/g, ""))).toBeGreaterThanOrEqual(0);
});
`;

const F002_SPEC = `import { test, expect } from "@playwright/test";

// F002: coupon SAVE10 is applied twice when Apply is clicked twice.
test("coupon SAVE10 is applied at most once per order", async ({ page }) => {
  await page.goto("${SHOP}/products/trail-runner-jacket");
  await page.getByRole("button", { name: "Add to cart" }).click();
  await page.goto("${SHOP}/cart");

  const coupon = page.getByRole("textbox", { name: "Coupon code" });
  await coupon.fill("SAVE10");
  const apply = page.getByRole("button", { name: "Apply" });
  await apply.click();
  await apply.click();

  await expect(page.getByText(/Discount SAVE10/)).toHaveCount(1);
  await expect(page.getByTestId("cart-total")).toHaveText("$124.10");
});
`;

const REPORT_MD = `# QA report: Demo Shop

- **Target:** ${SHOP}
- **Objective:** Test this application and find any broken functionality.
- **Outcome:** 4 candidate findings. **2 confirmed**, 1 flaky, 1 inconclusive. 2 regression tests written; both currently fail and reproduce their bug.

## Findings

| ID | Severity | Status | Title |
|----|----------|--------|-------|
| F001 | critical | confirmed | Cart accepts negative quantities and shows a negative total |
| F002 | high | confirmed | Coupon SAVE10 is applied twice when Apply is clicked twice |
| F003 | medium | flaky | Search returns no results for queries with trailing whitespace |
| F004 | medium | inconclusive | "Place order" stays disabled after correcting an invalid email |

## Confirmed bugs

### F001 · Cart accepts negative quantities (critical)

Typing \`-3\` into the cart quantity field is accepted. The line total becomes **-$387.00** and the order total **-$379.00**. Checkout remains enabled with a negative total.

- **Expected:** quantity is clamped to a minimum of 1 and totals stay positive.
- **Actual:** negative quantity accepted; totals go negative.
- **Root cause (hypothesis):** the quantity input is \`type="number"\` without \`min\`, and the cart reducer multiplies price by the raw parsed value.
- **Verification:** reproduced on attempt 1 in a fresh browser context. Video and trace attached.
- **Regression test:** \`tests/regression/F001-negative-quantity.spec.ts\` (fails, reproduces bug).

### F002 · Coupon applied twice (high)

Clicking **Apply** twice with \`SAVE10\` adds two 10% discount lines, dropping the total from $124.10 to $111.20.

- **Expected:** a coupon applies once; re-applying is a no-op.
- **Actual:** each click appends another discount line.
- **Root cause (hypothesis):** \`applyCoupon\` pushes onto \`cart.discounts\` without checking for an existing code.
- **Regression test:** \`tests/regression/F002-coupon-double-apply.spec.ts\` (fails, reproduces bug).

## Needs attention

### F003 · Search ignores queries with trailing whitespace (medium, flaky)

Searching for \`"jacket "\` returned no results during exploration and on the second verification attempt, but returned 3 results on the first attempt. Likely a race between the debounced input and the trimmed query parameter.

### F004 · Place order stays disabled (medium, inconclusive)

Observed once during exploration. Verification was **blocked**: the checkout page returned HTTP 502 from the payment stub, so the form never rendered. Re-run verification once the payment stub is healthy.

## Coverage

- Visited: home, catalog, product page, cart, coupon flow, search, checkout form.
- Not covered: account sign-in, order history, payment capture (stub returned 502), mobile layout.

## Recommendations

1. Add \`min="1"\` to the quantity input and clamp server-side in the cart reducer.
2. Deduplicate coupon codes in \`applyCoupon\`.
3. Trim the search query before matching and cover it with a unit test.
4. Fix the payment stub health check, then re-verify F004.
`;

function finding(
  runId: string,
  id: string,
  ts: string,
  data: Omit<Finding, "id" | "run_id" | "created_at" | "updated_at" | "evidence_urls" | "video_url" | "trace_url" | "root_cause" | "test_id" | "verification_attempts"> &
    Partial<Pick<Finding, "video_url" | "trace_url" | "root_cause" | "test_id" | "verification_attempts">>,
): Finding {
  return {
    id,
    run_id: runId,
    created_at: ts,
    updated_at: ts,
    evidence_urls: data.evidence_shots.map((s) => `/artifacts/${runId}/shots/${s}.png`),
    video_url: null,
    trace_url: null,
    root_cause: null,
    test_id: null,
    verification_attempts: [],
    ...data,
  };
}

export function buildFixture(runId: string, tsOf: (index: number) => string, variant: FixtureVariant = "full"): Fixture {
  const events: RunEvent[] = [];
  const shotUrl = (id: string) => `/artifacts/${runId}/shots/${id}.png`;
  const i = () => events.length;
  let cumulativeCost = 0;

  const emit = (type: string, agent: AgentName | null, session: string | null, payload: Record<string, unknown>) => {
    const seq = events.length + 1;
    events.push({ seq, ts: tsOf(seq - 1), type, agent, session, payload });
    return events[events.length - 1];
  };
  const usage = (agent: AgentName, input: number, output: number) => {
    const model = agent === "supervisor" ? SUPERVISOR_MODEL : WORKER_MODEL;
    const rate = agent === "supervisor" ? [5, 25] : [3, 15];
    const cost = (input * rate[0] + output * rate[1]) / 1_000_000;
    cumulativeCost += cost;
    emit("llm.usage", agent, null, {
      model,
      input_tokens: input,
      output_tokens: output,
      cost_usd: Number(cost.toFixed(6)),
      cumulative_cost_usd: Number(cumulativeCost.toFixed(6)),
    });
  };
  const browser = (
    agent: AgentName,
    session: string,
    kind: BrowserActionPayload["kind"],
    shot: string,
    extra: Partial<BrowserActionPayload> = {},
  ) => {
    const info = SHOTS[shot];
    const payload: BrowserActionPayload = {
      session,
      kind,
      url: info?.url ?? SHOP,
      shot_id: shot,
      shot_url: shotUrl(shot),
      ...extra,
    };
    emit("browser.action", agent, session, payload as unknown as Record<string, unknown>);
  };
  const now = () => tsOf(i());

  // ---- Kickoff -------------------------------------------------------------
  emit("run.status", "system", null, { status: "running", message: "Browser ready; supervisor starting" });
  emit("agent.start", "supervisor", null, { agent: "supervisor", description: `Planning QA strategy for ${SHOP}` });
  emit("todo.update", "supervisor", null, { todos: todos(["in_progress"]) });
  usage("supervisor", 3812, 642);

  if (variant === "failed") {
    emit("tool.start", "supervisor", null, {
      tool: "task",
      args: { subagent: "explorer", instructions: `Smoke test the checkout flow at ${SHOP} with coupon SAVE10.` },
      call_id: "call_sup_01",
    });
    emit("agent.start", "explorer", "explore", { agent: "explorer", description: `Exploring storefront at ${SHOP}` });
    browser("explorer", "explore", "navigate", "s0028");
    usage("explorer", 2210, 188);
    emit("agent.end", "explorer", "explore", { agent: "explorer", summary: "Target app unreachable: ERR_CONNECTION_REFUSED on http://localhost:3001 after 3 attempts." });
    emit("tool.end", "supervisor", null, { tool: "task", call_id: "call_sup_01", result_preview: "Explorer aborted: target unreachable", error: "ECONNREFUSED" });
    emit("run.status", "system", null, { status: "failed", message: "Target application is not reachable at http://localhost:3001" });
    return { events, findings: [], tests: [], reportMd: "" };
  }

  // ---- Exploration ---------------------------------------------------------
  emit("tool.start", "supervisor", null, {
    tool: "task",
    args: {
      subagent: "explorer",
      instructions:
        "Explore the storefront end to end: browse the catalog, open a product, add it to the cart, apply a coupon, search, and start checkout. Probe quantity, coupon and form-validation edge cases. Report each defect with report_finding.",
    },
    call_id: "call_sup_01",
  });
  emit("agent.start", "explorer", "explore", { agent: "explorer", description: `Exploring storefront at ${SHOP}` });
  browser("explorer", "explore", "navigate", "s0001");
  usage("explorer", 4120, 310);
  browser("explorer", "explore", "click", "s0002", { target: { ref: "e12", role: "link", name: "Shop all" } });
  browser("explorer", "explore", "click", "s0003", { target: { ref: "e27", role: "link", name: "Trail Runner Jacket" } });
  browser("explorer", "explore", "click", "s0004", { target: { ref: "e41", role: "button", name: "Add to cart" } });
  usage("explorer", 6880, 402);
  browser("explorer", "explore", "navigate", "s0005");
  browser("explorer", "explore", "type", "s0006", { target: { ref: "e31", role: "spinbutton", name: "Quantity" }, text: "-3" });

  const f001Created = now();
  const F001 = finding(runId, "F001", f001Created, {
    title: "Cart accepts negative quantities and shows a negative total",
    severity: "critical",
    feature: "Cart",
    expected: "Quantity is clamped to a minimum of 1; line and order totals stay positive.",
    actual: "Typing -3 into Quantity is accepted. Line total shows -$387.00 and order total -$379.00; Checkout stays enabled.",
    repro_steps: [
      "Open /products/trail-runner-jacket and click “Add to cart”.",
      "Open /cart.",
      "Clear the Quantity field and type -3.",
      "Observe the line total and order total.",
    ],
    evidence_shots: ["s0005", "s0006"],
    status: "candidate",
  });
  emit("tool.start", "explorer", "explore", {
    tool: "report_finding",
    args: { title: F001.title, severity: F001.severity, feature: F001.feature, evidence_shots: F001.evidence_shots },
    call_id: "call_exp_01",
  });
  emit("finding.created", "explorer", "explore", { finding: F001 });
  emit("tool.end", "explorer", "explore", { tool: "report_finding", call_id: "call_exp_01", result_preview: "Recorded F001 (critical, candidate): Cart accepts negative quantities" });

  browser("explorer", "explore", "type", "s0007", { target: { ref: "e40", role: "textbox", name: "Coupon code" }, text: "SAVE10" });
  browser("explorer", "explore", "click", "s0008", { target: { ref: "e42", role: "button", name: "Apply" } });
  browser("explorer", "explore", "click", "s0009", { target: { ref: "e42", role: "button", name: "Apply" } });
  const F002 = finding(runId, "F002", now(), {
    title: "Coupon SAVE10 is applied twice when Apply is clicked twice",
    severity: "high",
    feature: "Cart / Coupons",
    expected: "A coupon applies once per order; clicking Apply again is a no-op or shows “already applied”.",
    actual: "Each click appends another “Discount SAVE10 (10%)” line. Total drops from $124.10 to $111.20.",
    repro_steps: [
      "Add “Trail Runner Jacket” to the cart and open /cart.",
      "Type SAVE10 into Coupon code.",
      "Click Apply twice.",
      "Observe two discount lines in the order summary.",
    ],
    evidence_shots: ["s0008", "s0009"],
    status: "candidate",
  });
  emit("finding.created", "explorer", "explore", { finding: F002 });
  usage("explorer", 8030, 488);

  browser("explorer", "explore", "navigate", "s0010");
  const F003 = finding(runId, "F003", now(), {
    title: "Search returns no results for queries with trailing whitespace",
    severity: "medium",
    feature: "Search",
    expected: "“jacket ” (trailing space) matches the same products as “jacket”.",
    actual: "The results page shows “No results for ‘jacket ’” although 3 jackets exist.",
    repro_steps: ["Open /search.", "Type “jacket ” with a trailing space and submit.", "Observe zero results."],
    evidence_shots: ["s0010"],
    status: "candidate",
  });
  emit("finding.created", "explorer", "explore", { finding: F003 });

  browser("explorer", "explore", "navigate", "s0011");
  browser("explorer", "explore", "type", "s0012", { target: { ref: "e55", role: "textbox", name: "Email" }, text: "not-an-email" });
  browser("explorer", "explore", "type", "s0013", { target: { ref: "e55", role: "textbox", name: "Email" }, text: "qa@example.com" });
  usage("explorer", 9140, 610);
  const F004 = finding(runId, "F004", now(), {
    title: "“Place order” stays disabled after correcting an invalid email",
    severity: "medium",
    feature: "Checkout",
    expected: "Once every field is valid, “Place order” becomes enabled.",
    actual: "After replacing “not-an-email” with a valid address, the validation message clears but the button stays disabled.",
    repro_steps: [
      "Open /checkout with one item in the cart.",
      "Type not-an-email into Email, then fill the remaining fields.",
      "Replace the email with qa@example.com.",
      "Observe “Place order” is still disabled.",
    ],
    evidence_shots: ["s0012", "s0013"],
    status: "candidate",
  });
  emit("finding.created", "explorer", "explore", { finding: F004 });
  emit("agent.end", "explorer", "explore", {
    agent: "explorer",
    summary: "Explored 7 pages with 13 actions. Reported 4 candidate findings: F001 (critical), F002 (high), F003 and F004 (medium).",
  });
  emit("tool.end", "supervisor", null, {
    tool: "task",
    call_id: "call_sup_01",
    result_preview: "Explorer finished: 4 candidate findings (1 critical, 1 high, 2 medium).",
  });
  emit("todo.update", "supervisor", null, { todos: todos(["completed", "completed", "in_progress"]) });
  usage("supervisor", 14210, 820);

  if (variant === "stopped") {
    emit("run.status", "system", null, { status: "stopped", message: "Stopped by user" });
    return { events, findings: [F001, F002, F003, F004], tests: [], reportMd: "" };
  }

  // ---- Verification: F001 ----------------------------------------------------
  emit("tool.start", "supervisor", null, {
    tool: "task",
    args: { subagent: "verifier", finding_id: "F001", instructions: "Reproduce F001 in a fresh browser context following the repro steps exactly. Record video and trace." },
    call_id: "call_sup_02",
  });
  emit("agent.start", "verifier", "verify-F001", { agent: "verifier", description: "Verifying F001 in a fresh browser context" });
  browser("verifier", "verify-F001", "reset", "s0014");
  browser("verifier", "verify-F001", "navigate", "s0015");
  browser("verifier", "verify-F001", "click", "s0016", { target: { ref: "e41", role: "button", name: "Add to cart" } });
  browser("verifier", "verify-F001", "navigate", "s0017");
  browser("verifier", "verify-F001", "type", "s0018", { target: { ref: "e31", role: "spinbutton", name: "Quantity" }, text: "-3" });
  const F001v: Finding = {
    ...F001,
    status: "confirmed",
    updated_at: now(),
    verification_attempts: [
      {
        attempt: 1,
        outcome: "reproduced",
        notes: "Fresh context. Quantity -3 accepted; cart total rendered -$379.00 and Checkout stayed enabled.",
        shot_urls: [shotUrl("s0017"), shotUrl("s0018")],
      },
    ],
    video_url: `/artifacts/${runId}/videos/verify-F001.mp4`,
    trace_url: `/artifacts/${runId}/traces/verify-F001.zip`,
    root_cause: "Quantity input is type=number without a min attribute; the cart reducer multiplies price by the raw parsed value.",
  };
  emit("finding.updated", "verifier", "verify-F001", { finding: F001v });
  emit("agent.end", "verifier", "verify-F001", { agent: "verifier", summary: "F001 reproduced on attempt 1. Status: confirmed. Video and trace saved." });
  emit("tool.end", "supervisor", null, { tool: "task", call_id: "call_sup_02", result_preview: "F001 confirmed (1/1 reproduced)" });

  // ---- Verification: F002 ----------------------------------------------------
  emit("agent.start", "verifier", "verify-F002", { agent: "verifier", description: "Verifying F002 in a fresh browser context" });
  browser("verifier", "verify-F002", "navigate", "s0019");
  browser("verifier", "verify-F002", "click", "s0020", { target: { ref: "e41", role: "button", name: "Add to cart" } });
  browser("verifier", "verify-F002", "navigate", "s0021");
  browser("verifier", "verify-F002", "type", "s0022", { target: { ref: "e40", role: "textbox", name: "Coupon code" }, text: "SAVE10" });
  browser("verifier", "verify-F002", "click", "s0023", { target: { ref: "e42", role: "button", name: "Apply" } });
  browser("verifier", "verify-F002", "click", "s0024", { target: { ref: "e42", role: "button", name: "Apply" } });
  usage("verifier", 5120, 340);
  const F002v: Finding = {
    ...F002,
    status: "confirmed",
    updated_at: now(),
    verification_attempts: [
      {
        attempt: 1,
        outcome: "reproduced",
        notes: "Two “Discount SAVE10 (10%)” lines after two clicks; total $111.20.",
        shot_urls: [shotUrl("s0023"), shotUrl("s0024")],
      },
    ],
    trace_url: `/artifacts/${runId}/traces/verify-F002.zip`,
    root_cause: "applyCoupon pushes onto cart.discounts without checking whether the code is already present.",
  };
  emit("finding.updated", "verifier", "verify-F002", { finding: F002v });
  emit("agent.end", "verifier", "verify-F002", { agent: "verifier", summary: "F002 reproduced on attempt 1. Status: confirmed." });

  // ---- Verification: F003 (flaky) --------------------------------------------
  emit("agent.start", "verifier", "verify-F003", { agent: "verifier", description: "Verifying F003 in a fresh browser context" });
  browser("verifier", "verify-F003", "navigate", "s0025");
  const F003a: Finding = {
    ...F003,
    status: "potential",
    updated_at: now(),
    verification_attempts: [
      { attempt: 1, outcome: "not_reproduced", notes: "Search for “jacket ” returned 3 results.", shot_urls: [shotUrl("s0025")] },
    ],
  };
  emit("finding.updated", "verifier", "verify-F003", { finding: F003a });
  browser("verifier", "verify-F003", "reload", "s0026");
  const F003b: Finding = {
    ...F003a,
    status: "flaky",
    updated_at: now(),
    verification_attempts: [
      ...F003a.verification_attempts,
      { attempt: 2, outcome: "reproduced", notes: "After reload the same query returned “No results”.", shot_urls: [shotUrl("s0026")] },
    ],
    root_cause: "Likely a race between the debounced search input and the trimmed query parameter.",
  };
  emit("finding.updated", "verifier", "verify-F003", { finding: F003b });
  emit("agent.end", "verifier", "verify-F003", { agent: "verifier", summary: "F003 reproduced in 1 of 2 attempts. Status: flaky." });

  // ---- Verification: F004 (blocked) ------------------------------------------
  emit("agent.start", "verifier", "verify-F004", { agent: "verifier", description: "Verifying F004 in a fresh browser context" });
  browser("verifier", "verify-F004", "navigate", "s0027");
  const F004v: Finding = {
    ...F004,
    status: "inconclusive",
    updated_at: now(),
    verification_attempts: [
      {
        attempt: 1,
        outcome: "blocked",
        notes: "Checkout returned HTTP 502 from the payment stub; the form never rendered.",
        shot_urls: [shotUrl("s0027")],
      },
    ],
  };
  emit("finding.updated", "verifier", "verify-F004", { finding: F004v });
  emit("agent.end", "verifier", "verify-F004", { agent: "verifier", summary: "Verification blocked by a 502 from the payment stub. Status: inconclusive." });
  emit("todo.update", "supervisor", null, { todos: todos(["completed", "completed", "completed", "in_progress"]) });
  usage("supervisor", 18920, 1040);

  // ---- Regression tests ------------------------------------------------------
  emit("agent.start", "test_writer", null, { agent: "test_writer", description: "Writing regression specs for F001 and F002" });
  const T001: TestCase = {
    id: "T001",
    run_id: runId,
    finding_id: "F001",
    path: "tests/regression/F001-negative-quantity.spec.ts",
    code: F001_SPEC,
    last_result: null,
    created_at: now(),
  };
  emit("test.saved", "test_writer", null, { test: T001 });
  emit("tool.start", "test_writer", null, { tool: "run_playwright", args: { spec: T001.path }, call_id: "call_tw_02" });
  const T001r: TestCase = {
    ...T001,
    last_result: {
      status: "failed",
      error:
        "Error: expect(received).toBeGreaterThanOrEqual(expected)\n\nExpected: >= 0\nReceived: -379\n\n  at tests/regression/F001-negative-quantity.spec.ts:16:67",
      duration_ms: 4312,
      reproduces_bug: true,
      ran_at: now(),
    },
  };
  emit("test.result", "test_writer", null, { test: T001r });
  emit("tool.end", "test_writer", null, { tool: "run_playwright", call_id: "call_tw_02", result_preview: "1 failed (4.3s): reproduces F001" });

  const T002: TestCase = {
    id: "T002",
    run_id: runId,
    finding_id: "F002",
    path: "tests/regression/F002-coupon-double-apply.spec.ts",
    code: F002_SPEC,
    last_result: null,
    created_at: now(),
  };
  emit("test.saved", "test_writer", null, { test: T002 });
  const T002r: TestCase = {
    ...T002,
    last_result: {
      status: "failed",
      error:
        "Error: expect(locator).toHaveCount(expected)\n\nLocator: getByText(/Discount SAVE10/)\nExpected: 1\nReceived: 2\n\n  at tests/regression/F002-coupon-double-apply.spec.ts:15:52",
      duration_ms: 3890,
      reproduces_bug: true,
      ran_at: now(),
    },
  };
  emit("test.result", "test_writer", null, { test: T002r });
  usage("test_writer", 11240, 2210);
  emit("agent.end", "test_writer", null, { agent: "test_writer", summary: "Wrote 2 specs; both fail against the current build and reproduce their bug." });
  emit("todo.update", "supervisor", null, { todos: todos(["completed", "completed", "completed", "completed", "in_progress"]) });

  // ---- Report ----------------------------------------------------------------
  usage("supervisor", 22480, 2960);
  emit("report.final", "supervisor", null, { report_md: REPORT_MD });
  emit("todo.update", "supervisor", null, { todos: todos(["completed", "completed", "completed", "completed", "completed"]) });
  emit("agent.end", "supervisor", null, {
    agent: "supervisor",
    summary: "Run complete: 2 confirmed bugs, 1 flaky, 1 inconclusive; 2 regression tests reproduce their bug.",
  });
  emit("run.status", "system", null, { status: "completed" });

  const finalF001 = { ...F001v, test_id: "T001" };
  const finalF002 = { ...F002v, test_id: "T002" };
  return {
    events,
    findings: [finalF001, finalF002, F003b, F004v],
    tests: [T001r, T002r],
    reportMd: REPORT_MD,
  };
}
