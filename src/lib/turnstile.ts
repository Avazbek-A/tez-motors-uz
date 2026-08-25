/**
 * Server-side Cloudflare Turnstile verification.
 * If TURNSTILE_SECRET is unset, verification is skipped (fail-open so dev works).
 * In production, set the secret via `wrangler secret put TURNSTILE_SECRET`.
 */
import { logEvent } from "@/lib/error-report";

export async function verifyTurnstile(
  token: string | null | undefined,
  remoteIp?: string,
): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET;
  if (!secret) return true; // not configured — allow

  // A MISSING token means the widget never issued one. That is usually our
  // problem, not a bot's: a stale/misconfigured sitekey, a deprecated render
  // parameter, an ad blocker, a Turnstile outage. Rejecting it cost the dealer
  // every lead the site collected — /api/inquiry answered 400 "Captcha
  // verification failed" to real customers for as long as the widget was
  // broken, and nothing in the product surfaced that.
  //
  // So a missing token is logged loudly and let through (the routes' per-IP rate
  // limits still apply), while a token that is PRESENT and fails verification is
  // still rejected — that is the case that actually indicates forgery. Set
  // TURNSTILE_STRICT=true to refuse tokenless submissions instead, once the
  // widget is confirmed healthy.
  if (!token) {
    const strict = (process.env.TURNSTILE_STRICT || "").toLowerCase() === "true";
    logEvent("turnstile.missing_token", { strict }, "warn");
    return !strict;
  }

  try {
    const form = new FormData();
    form.append("secret", secret);
    form.append("response", token);
    if (remoteIp) form.append("remoteip", remoteIp);

    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: form,
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { success?: boolean };
    return Boolean(data.success);
  } catch {
    // Network failure — fail open rather than blocking legit submissions.
    return true;
  }
}
