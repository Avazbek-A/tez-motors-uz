import { test, expect } from "@playwright/test";

test.describe("public shell", () => {
  test("/ redirects to a localized home and renders the brand", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/(ru|uz|en)(\/|$)/);
    await expect(page.locator("body")).toContainText(/Tez Motors/i);
  });

  test("catalog page loads", async ({ page }) => {
    const res = await page.goto("/ru/catalog");
    expect(res?.status()).toBeLessThan(400);
    await expect(page.locator("h1, h2").first()).toBeVisible();
  });

  test("has no console error overlay on the homepage", async ({ page }) => {
    await page.goto("/ru");
    await expect(page.locator("text=Application error")).toHaveCount(0);
  });
});
