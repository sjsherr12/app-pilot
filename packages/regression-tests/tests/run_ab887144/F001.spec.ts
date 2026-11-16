/**
 * F001 — Cart line total ignores quantity at qty 3 (shows unit price $18.50 instead of $55.50),
 *        so subtotal, shipping and total are wrong.
 *
 * Expected (product notes): line total = unit price × quantity; Subtotal = sum of line totals;
 *   Shipping is "Free" when subtotal >= $50.00. Canvas Tote Bag × 3 → $55.50 / $55.50 / Free / $55.50.
 * Actual: at qty 3 the line total is $18.50, Subtotal $18.50, Shipping $5.99, Total $24.49.
 *
 * Repro:
 *   1. Reset environment; open / as a guest
 *   2. Click "Add Canvas Tote Bag to cart"
 *   3. Click "Cart (1)"
 *   4. Click "Increase quantity for Canvas Tote Bag" twice (header shows "Cart (3)")
 *   5. Read line total, Subtotal, Shipping and Total
 */
import { test, expect } from "@playwright/test";

const APP_URL = process.env.APP_URL ?? "http://localhost:3001";
const tenant = `rt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

test.beforeEach(async ({ context, request }) => {
  await context.addCookies([{ name: "apx_tenant", value: tenant, url: APP_URL }]);
  await request.post(`${APP_URL}/__test/reset?tenant=${tenant}`);
});

test("Cart line total ignores quantity at qty 3, so subtotal, shipping and total are wrong", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Add Canvas Tote Bag to cart" }).click();
  await page.getByRole("link", { name: "Cart (1)" }).click();
  await expect(page).toHaveURL(/\/cart$/);

  const increase = page.getByRole("button", { name: "Increase quantity for Canvas Tote Bag" });
  await increase.click();
  await expect(page.getByRole("link", { name: "Cart (2)" })).toBeVisible();
  await increase.click();
  await expect(page.getByRole("link", { name: "Cart (3)" })).toBeVisible();

  const main = page.getByRole("main");
  // Line total: 3 × $18.50
  await expect.soft(main, "Canvas Tote Bag line total should be 3 × $18.50").toContainText("$55.50");
  // Order summary
  await expect.soft(main, "Subtotal should be $55.50").toContainText(/Subtotal\s*\$55\.50/);
  await expect.soft(main, "Shipping should be Free at subtotal >= $50").toContainText(/Shipping\s*Free/);
  await expect(main, "Total should be $55.50").toContainText(/Total\s*\$55\.50/);
});
