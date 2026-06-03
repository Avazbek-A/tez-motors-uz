/**
 * tez-motors cron Worker.
 *
 * Cloudflare fires scheduled() with event.cron set to the matched expression
 * (see ../wrangler.toml [triggers]). We map each expression to one of the
 * Next app's /api/cron/* routes and call it with the shared bearer secret.
 *
 * Everything here is fail-soft: a failing job logs and returns; it must never
 * throw in a way that masks the others. Each invocation runs exactly one job
 * (Cloudflare delivers one event per matched trigger).
 */

// cron expression -> app route path
const ROUTES = {
  "0 1 * * *": "/api/cron/rates",
  "30 3 * * *": "/api/cron/lead-digest",
  "0 4 * * *": "/api/cron/follow-ups",
  "0 */6 * * *": "/api/cron/price-watch-sweep",
  "0 5 * * *": "/api/cron/otp-cleanup",
  "30 6 * * *": "/api/cron/saved-search-alerts",
  "0 7 * * *": "/api/cron/review-requests",
  "20 */2 * * *": "/api/cron/reservation-recovery",
  "0 3 * * *": "/api/cron/ops-digest",
  "30 4 * * *": "/api/cron/order-sla",
  "30 5 * * *": "/api/cron/lead-nurture",
  "0 6 * * 1": "/api/cron/inventory-aging",
  "0 8 * * *": "/api/cron/service-reminders",
  "0 5 1 * *": "/api/cron/monthly-report",
  "0 7 * * 2": "/api/cron/win-back",
  "15 4 * * *": "/api/cron/generate-tasks",
  "45 4 * * *": "/api/cron/shipment-sla",
  "0 * * * *": "/api/cron/marketing-poster",
  "10 * * * *": "/api/cron/promotions-apply",
  "0 9 * * 3": "/api/cron/warranty-expiry",
  "20 3 * * *": "/api/cron/operator-briefing",
};

async function fire(path, env) {
  const base = env.APP_BASE_URL || "https://tezmotors.uz";
  const url = `${base}${path}`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        authorization: `Bearer ${env.CRON_SECRET || ""}`,
        "content-type": "application/json",
      },
    });
    const body = await res.text();
    console.log(`cron ${path} -> ${res.status} ${body.slice(0, 200)}`);
    return res.ok;
  } catch (err) {
    console.error(`cron ${path} failed`, err);
    return false;
  }
}

export default {
  async scheduled(event, env, ctx) {
    const path = ROUTES[event.cron];
    if (!path) {
      console.error(`cron: no route for expression "${event.cron}"`);
      return;
    }
    ctx.waitUntil(fire(path, env));
  },

  // Optional manual trigger: GET /run?path=/api/cron/rates for ad-hoc testing.
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/run") {
      const path = url.searchParams.get("path");
      if (!path || !Object.values(ROUTES).includes(path)) {
        return new Response("unknown path", { status: 400 });
      }
      const ok = await fire(path, env);
      return new Response(ok ? "ok" : "failed", { status: ok ? 200 : 502 });
    }
    return new Response("tez-motors cron worker", { status: 200 });
  },
};
