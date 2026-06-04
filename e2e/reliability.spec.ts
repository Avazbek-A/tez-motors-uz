import { test, expect } from "@playwright/test";

// Phase AT — guard the operational floor + money/contract surfaces.
// Data-independent: asserts contracts and endpoints, not specific records.

test.describe("reliability & money surfaces", () => {
  test("health endpoint responds with an ok shape", async ({ request }) => {
    const res = await request.get("/api/health");
    // 200 healthy or 503 if the DB is unreachable in this env — both valid,
    // both JSON with a boolean ok + a checks object.
    expect([200, 503]).toContain(res.status());
    const body = await res.json();
    expect(typeof body.ok).toBe("boolean");
    expect(body.checks).toBeTruthy();
  });

  test("reservation API rejects an invalid body (no order created on bad input)", async ({ request }) => {
    const res = await request.post("/api/reservation", { data: { car_id: "not-a-uuid" } });
    expect(res.status()).toBeGreaterThanOrEqual(400);
    const body = await res.json();
    expect(body.success).toBeFalsy();
  });

  test("sign API requires code + phone (no enumeration by code alone)", async ({ request }) => {
    const res = await request.get("/api/sign?type=sales_contract");
    expect(res.status()).toBe(400);
  });

  test("contract sign page renders the lookup form", async ({ page }) => {
    await page.goto("/ru/sign");
    await expect(page.locator("input").first()).toBeVisible();
  });

  test("rum beacon accepts a metric and never errors", async ({ request }) => {
    const res = await request.post("/api/rum", { data: { metric: "LCP", value: 1234, rating: "good", path: "/ru" } });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });
});
