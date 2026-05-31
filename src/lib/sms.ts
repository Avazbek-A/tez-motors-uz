/**
 * SMS delivery via Eskiz.uz (the standard UZ transactional SMS gateway).
 *
 * Workers-safe: a single fetch for auth + a single fetch for send, no node deps.
 * Fail-open exactly like telegram.ts / email.ts: when ESKIZ_EMAIL /
 * ESKIZ_PASSWORD are unset (local dev, or before the dealer's sender template is
 * approved), we DON'T send — we log the message server-side so the OTP flow is
 * still testable, and return { ok: false, skipped: true }. The caller must never
 * 500 because SMS is unconfigured.
 *
 * Token note: Eskiz issues a bearer token from email+password. We fetch a fresh
 * token per send. OTP volume is tiny, so the extra round-trip is fine and avoids
 * caching a secret across Worker isolates.
 */
import { logEvent } from "./error-report";

const ESKIZ_BASE = "https://notify.eskiz.uz/api";

export interface SmsResult {
  ok: boolean;
  skipped?: boolean;
}

async function getEskizToken(email: string, password: string): Promise<string | null> {
  try {
    const form = new FormData();
    form.append("email", email);
    form.append("password", password);
    const res = await fetch(`${ESKIZ_BASE}/auth/login`, { method: "POST", body: form });
    if (!res.ok) return null;
    const json = (await res.json()) as { data?: { token?: string } };
    return json?.data?.token ?? null;
  } catch {
    return null;
  }
}

export async function sendSms(phone: string, message: string): Promise<SmsResult> {
  const email = process.env.ESKIZ_EMAIL;
  const password = process.env.ESKIZ_PASSWORD;

  if (!email || !password) {
    // Dev / unconfigured: surface the message in logs so the flow is testable.
    logEvent("sms.skipped", { phone, message }, "warn");
    return { ok: false, skipped: true };
  }

  try {
    const token = await getEskizToken(email, password);
    if (!token) {
      logEvent("sms.auth_failed", { phone }, "error");
      return { ok: false };
    }

    const form = new FormData();
    // Eskiz expects the national number without the leading "+".
    form.append("mobile_phone", phone.replace(/^\+/, ""));
    form.append("message", message);
    if (process.env.ESKIZ_FROM) form.append("from", process.env.ESKIZ_FROM);

    const res = await fetch(`${ESKIZ_BASE}/message/sms/send`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    if (!res.ok) {
      logEvent("sms.send_failed", { phone, status: res.status }, "error");
      return { ok: false };
    }
    return { ok: true };
  } catch (err) {
    logEvent("sms.exception", { phone, message: String(err) }, "error");
    return { ok: false };
  }
}

const OTP_TEXT: Record<string, (code: string) => string> = {
  ru: (code) => `Tez Motors: ваш код входа ${code}. Никому его не сообщайте.`,
  uz: (code) => `Tez Motors: kirish kodingiz ${code}. Uni hech kimga aytmang.`,
  en: (code) => `Tez Motors: your login code is ${code}. Do not share it.`,
};

export function otpMessage(locale: string, code: string): string {
  const fn = OTP_TEXT[locale] ?? OTP_TEXT.ru;
  return fn(code);
}
