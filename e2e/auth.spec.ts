import { test, expect } from "@playwright/test";

// The admin is the control plane for inventory, orders, and money. Its login
// page must render a password entry point. (Route-level auth is enforced
// server-side by requireAdmin on every /api/admin/** call + admin actions.)
test.describe("admin auth gate", () => {
  test("login page renders a password field", async ({ page }) => {
    const res = await page.goto("/admin/login");
    expect(res?.status()).toBeLessThan(400);
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test("an admin API rejects an unauthenticated request", async ({ request }) => {
    const res = await request.get("/api/admin/stats/automation");
    expect([401, 403]).toContain(res.status());
  });
});
