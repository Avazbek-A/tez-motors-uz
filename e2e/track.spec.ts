import { test, expect } from "@playwright/test";

// The order-track form is the customer's window into a paid order. It must
// render and require both a reference code and a phone (no enumeration by code
// alone). Data-independent — asserts the form contract, not a specific order.
test.describe("order tracking", () => {
  test("renders the lookup form with code + phone, both required", async ({ page }) => {
    await page.goto("/ru/track");
    const inputs = page.locator("input");
    await expect(inputs).toHaveCount(2);
    // Both fields are required → the browser blocks an empty submit.
    await expect(inputs.nth(0)).toHaveAttribute("required", "");
    await expect(inputs.nth(1)).toHaveAttribute("required", "");
  });
});
