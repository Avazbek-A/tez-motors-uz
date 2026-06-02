/**
 * Fire-and-forget server-error alert to Telegram.
 *
 * Server errors otherwise only hit console.error, which nobody watches on a
 * Cloudflare Worker. This pings the dealer's bot so a broken checkout / lead
 * path surfaces immediately. Set TELEGRAM_ERROR_CHAT_ID to route alerts to a
 * separate channel; otherwise it falls back to the main notification chat.
 *
 * Plain-text only (no parse_mode) so error strings with Markdown characters
 * can't break formatting or get partially swallowed.
 */
function errorMessage(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

export type LogLevel = "info" | "warn" | "error";

/**
 * Structured, greppable event log line for Cloudflare Workers Logs / Logpush.
 *
 * Emits one JSON object per call with a stable `event` tag so the money + auth
 * chokepoints (price-watch sends, admin login, order status changes, and — once
 * they land — Payme callbacks and OTP verify) can be filtered and timed without
 * a third-party APM. Never throws: observability must not break a request.
 */
export function logEvent(
  event: string,
  fields: Record<string, unknown> = {},
  level: LogLevel = "info",
): void {
  try {
    const line = JSON.stringify({ event, level, ts: new Date().toISOString(), ...fields });
    if (level === "error") console.error(line);
    else if (level === "warn") console.warn(line);
    else console.log(line);
  } catch {
    // ignore serialization failures
  }

  // Record the heartbeat for scheduled jobs so the autopilot command-center can
  // show which crons ran and with what result. Fire-and-forget, fail-open
  // (reliable on a long-lived Node host; best-effort on Workers without
  // waitUntil — acceptable for observability).
  if (event.startsWith("cron.")) {
    void recordCronRun(event.slice(5), fields);
  }

  // Persist error-level events to an in-house, queryable feed (admin → Errors).
  // Fire-and-forget, fail-open; reliable on a Node host, best-effort on Workers.
  if (level === "error") {
    void recordErrorEvent(event, fields);
  }
}

async function recordCronRun(job: string, detail: Record<string, unknown>): Promise<void> {
  try {
    const { createServiceClient } = await import("@/lib/supabase/service");
    const supabase = createServiceClient();
    await supabase.from("cron_runs").insert({ job, detail });
  } catch {
    // observability must never break a cron
  }
}

async function recordErrorEvent(event: string, detail: Record<string, unknown>): Promise<void> {
  try {
    const { createServiceClient } = await import("@/lib/supabase/service");
    const supabase = createServiceClient();
    await supabase.from("error_events").insert({ event, detail });
  } catch {
    // observability must never break a request
  }
}

/**
 * Best-effort de-dupe so a failure inside a tight loop (a cron sweep, a payment
 * retry storm) can't flood the dealer with the same alert. Per-isolate only —
 * Workers isolates are short-lived, which is exactly the window we want to
 * collapse. Cross-isolate dedupe is not worth a KV round-trip on an error path.
 */
const ALERT_THROTTLE_MS = 5 * 60 * 1000;
const lastAlertAt = new Map<string, number>();

function shouldAlert(key: string): boolean {
  const now = Date.now();
  const prev = lastAlertAt.get(key) || 0;
  if (now - prev < ALERT_THROTTLE_MS) return false;
  lastAlertAt.set(key, now);
  return true;
}

/**
 * Push a dealer-facing operational alert over every configured channel
 * (Telegram error chat + dealer email). Fail-open and throttled. Used for the
 * silent-breakage paths the request handler swallows by design: cron failures,
 * payment-callback errors, and a fully-failed inquiry notification fan-out.
 *
 * `key` controls the throttle bucket (defaults to `title`).
 */
export async function alertDealer(
  title: string,
  lines: string[] = [],
  opts: { key?: string } = {},
): Promise<void> {
  if (!shouldAlert(opts.key || title)) return;

  const text = [`🚨 ${title}`, ...lines].join("\n").slice(0, 3500);
  const jobs: Promise<unknown>[] = [];

  // Telegram (error chat, falling back to the main notification chat).
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_ERROR_CHAT_ID || process.env.TELEGRAM_CHAT_ID;
  if (botToken && chatId) {
    jobs.push(
      fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
      }).catch(() => {}),
    );
  }

  // Dealer email (inlined Resend POST — keeps this module dependency-light and
  // free of any import cycle with the email templates).
  const to = process.env.DEALER_EMAIL;
  const from = process.env.EMAIL_FROM;
  const apiKey = process.env.RESEND_API_KEY;
  if (to && from && apiKey) {
    const html = `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.6;color:#18181b">
      <p style="font-size:16px;font-weight:bold;margin:0 0 8px">🚨 ${escapeHtml(title)}</p>
      <pre style="white-space:pre-wrap;font-family:inherit;margin:0">${escapeHtml(lines.join("\n"))}</pre>
    </div>`;
    jobs.push(
      fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from, to, subject: `[Alert] ${title}`.slice(0, 180), html }),
      }).catch(() => {}),
    );
  }

  try {
    await Promise.allSettled(jobs);
  } catch {
    // Never let observability break the caller.
  }
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export async function reportServerError(context: string, error: unknown): Promise<void> {
  // Always leave a structured breadcrumb in the logs, even when no alert channel
  // is configured — this is the only signal on a Worker otherwise.
  logEvent("server_error", { context, message: errorMessage(error) }, "error");

  // Telegram + dealer email, throttled per context so a looping failure can't storm.
  await alertDealer(`Server error — Tez Motors`, [
    `Where: ${context}`,
    `Error: ${errorMessage(error).slice(0, 1200)}`,
  ], { key: `server_error:${context}` });
}
