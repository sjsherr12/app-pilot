/**
 * F001: Cart line total, Subtotal, Shipping and Total are calculated as for 1 unit
 *       once a line's quantity reaches 3 or more.
 * Expected: Canvas Tote Bag x3 -> line total $55.50, Subtotal $55.50, Shipping Free, Total $55.50
 * Actual:   line total $18.50, Subtotal $18.50, Shipping $5.99, Total $24.49
 * Steps:
 *  1. Reset tenant and open / as a guest
 *  2. Click "Add Canvas Tote Bag to cart"
 *  3. Click "Cart (1)"
 *  4. Click "Increase quantity for Canvas Tote Bag" twice (header shows Cart (3))
 *  5. Check line total and order summary
 */
import { test, expect } from "@playwright/test";

const APP_URL = process.env.APP_URL ?? "http://localhost:3001";
const tenant = `rt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

test.beforeEach(async ({ context, request }) => {
  await context.addCookies([{ name: "apx_tenant", value: tenant, url: APP_URL }]);
  await request.post(`${APP_URL}/__test/reset?tenant=${tenant}`);
});

test("Cart totals are correct for Canvas Tote Bag at quantity 3", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Add Canvas Tote Bag to cart" }).click();
  await page.getByRole("link", { name: "Cart (1)" }).click();
  await expect(page).toHaveURL(/\/cart$/);

  const increase = page.getByRole("button", { name: "Increase quantity for Canvas Tote Bag" });
  await increase.click();
  await expect(page.getByRole("link", { name: "Cart (2)" })).toBeVisible();
  await increase.click();
  await expect(page.getByRole("link", { name: "Cart (3)" })).toBeVisible();

  const line = page.getByRole("row").filter({ hasText: "Canvas Tote Bag" });
  const summaryRow = (label: string) =>
    page.getByRole("row").filter({ has: page.getByText(label, { exact: true }) });

  await expect(line).toContainText("$55.50");
  await expect(summaryRow("Subtotal")).toContainText("$55.50");
  await expect(summaryRow("Shipping")).toContainText("Free");
  await expect(summaryRow("Total")).toContainText("$55.50");
});
