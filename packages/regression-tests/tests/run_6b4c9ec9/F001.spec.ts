/**
 * Regression test for F001
 * Title: Cart line total shows only the unit price at quantity 3 ($18.50 instead of $55.50),
 *        which makes the subtotal, shipping and total wrong
 *
 * Expected: line total = unit price × quantity. Canvas Tote Bag ($18.50) × 3 →
 *           Line total $55.50, Subtotal $55.50, Shipping Free (subtotal ≥ $50), Total $55.50.
 * Actual:   Line total $18.50, Subtotal $18.50, Shipping $5.99, Total $24.49.
 *
 * Repro steps:
 * 1. Reset environment and go to / as a guest
 * 2. Click "Add Canvas Tote Bag to cart"
 * 3. Click link "Cart (1)"
 * 4. Click "Increase quantity for Canvas Tote Bag" twice (header shows Cart (3))
 * 5. Observe the cart totals
 */
import { test, expect } from "@playwright/test";

const APP_URL = process.env.APP_URL ?? "http://localhost:3001";
const tenant = `rt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

test.beforeEach(async ({ context, request }) => {
  await context.addCookies([{ name: "apx_tenant", value: tenant, url: APP_URL }]);
  await request.post(`${APP_URL}/__test/reset?tenant=${tenant}`);
});

test("Cart line total equals unit price × quantity at quantity 3 (Canvas Tote Bag)", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Add Canvas Tote Bag to cart" }).click();
  await page.getByRole("link", { name: "Cart (1)" }).click();
  await expect(page).toHaveURL(/\/cart$/);

  const increase = page.getByRole("button", { name: "Increase quantity for Canvas Tote Bag" });
  await increase.click();
  await expect(page.getByRole("link", { name: "Cart (2)" })).toBeVisible();
  await increase.click();
  await expect(page.getByRole("link", { name: "Cart (3)" })).toBeVisible();

  // Subtotal $55.50 ≥ $50, so no flat $5.99 shipping charge and no $24.49 total.
  await expect(page.getByText("$24.49", { exact: true })).toHaveCount(0);
  // 3 × $18.50 = $55.50 must appear (line total / subtotal / total).
  await expect(page.getByText("$55.50", { exact: true }).first()).toBeVisible();
});
