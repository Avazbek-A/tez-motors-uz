/**
 * Server-side Cloudflare Turnstile verification.
 * If TURNSTILE_SECRET is unset, verification is skipped (fail-open so dev works).
 * In production, set the secret via `wrangler secret put TURNSTILE_SECRET`.
 */
export async function verifyTurnstile(
  token: string | null | undefined,
  remoteIp?: string,
): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET;
  if (!secret) return true; // not configured — allow
  if (!token) return false;

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
    // Network failure. The secret IS configured (checked above), so the operator
    // opted into captcha enforcement — fail CLOSED. Failing open here would let
    // an attacker who can induce siteverify failures bypass the bot gate on
    // every protected endpoint. (When unconfigured we already returned true.)
    return false;
  }
}
