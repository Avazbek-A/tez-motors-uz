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
  "30 6 * * 1": "/api/cron/marketing-autopilot",
  "0 8 * * 5": "/api/cron/market-digest",
  "0 7 * * 1": "/api/cron/auto-markdown",
  "30 7 * * 1": "/api/cron/auto-source",
  "*/15 * * * *": "/api/cron/synthetic",
  "20 * * * *": "/api/cron/journeys",
  "40 * * * *": "/api/cron/behavioral-triggers",
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

  // Optional manual trigger: GET/POST /run?path=/api/cron/rates for ad-hoc
  // testing. MUST present the shared secret (Authorization: Bearer <CRON_SECRET>
  // or ?secret=). Otherwise anyone who knows the worker URL could fire any
  // data-mutating / cost-incurring cron job — fire() attaches CRON_SECRET on the
  // caller's behalf, so an open /run is an auth-bypass-by-proxy of the
  // assertCron-protected routes. Fail closed when CRON_SECRET is unset.
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/run") {
      const auth = request.headers.get("authorization") || "";
      const provided = auth.startsWith("Bearer ") ? auth.slice(7) : (url.searchParams.get("secret") || "");
      if (!env.CRON_SECRET || !timingSafeEqual(provided, env.CRON_SECRET)) {
        return new Response("unauthorized", { status: 401 });
      }
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

// Constant-time string compare so /run auth can't be brute-forced via timing.
function timingSafeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
