import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end smoke tests against the running app. These cover money/auth-
 * adjacent UI flows (admin login gate, order-track form, the public shell) and
 * are resilient to placeholder data — they assert structure/behavior, not seeded
 * content, so they run in CI without a real database.
 *
 * One-time local setup: `npx playwright install chromium`.
 */
const PORT = 3000;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run build && npm run start",
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
    env: {
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key",
      NEXT_PUBLIC_SITE_URL: `http://localhost:${PORT}`,
    },
  },
});
