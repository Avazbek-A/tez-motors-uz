import { describe, it, expect } from "vitest";
import crypto from "node:crypto";
import { validateInitData, buildDataCheckString, telegramLocale } from "../telegram-initdata";

const BOT_TOKEN = "123456:TEST-bot-token-abcdef";

// Sign exactly as Telegram specifies (independent of the lib's Web Crypto path).
function sign(botToken: string, dataCheckString: string): string {
  const secret = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
  return crypto.createHmac("sha256", secret).update(dataCheckString).digest("hex");
}

/** Build a realistic, correctly-signed initData query string. */
function makeInitData(opts: { authDate: number; token?: string; user?: object } = { authDate: 0 }) {
  const user = JSON.stringify(
    opts.user ?? { id: 12345, first_name: "Ali", username: "ali", language_code: "ru" },
  );
  const fields: Record<string, string> = {
    query_id: "AAExampleQueryId",
    user,
    auth_date: String(opts.authDate),
  };
  // data_check_string = decoded "key=value" pairs (sans hash), sorted, "\n"-joined.
  const dcs = Object.keys(fields)
    .sort()
    .map((k) => `${k}=${fields[k]}`)
    .join("\n");
  const hash = sign(opts.token ?? BOT_TOKEN, dcs);
  return new URLSearchParams({ ...fields, hash }).toString();
}

describe("buildDataCheckString", () => {
  it("excludes hash, sorts keys, joins with newlines", () => {
    const initData = "b=2&hash=deadbeef&a=1&c=3";
    const { dataCheckString, hash } = buildDataCheckString(initData);
    expect(hash).toBe("deadbeef");
    expect(dataCheckString).toBe("a=1\nb=2\nc=3");
  });
});

describe("validateInitData", () => {
  const now = 1_900_000_000_000; // fixed clock (ms)
  const fresh = Math.floor(now / 1000) - 60;

  it("accepts a correctly-signed, fresh payload and returns the user", async () => {
    const initData = makeInitData({ authDate: fresh });
    const r = await validateInitData(initData, BOT_TOKEN, { nowMs: now });
    expect(r.valid).toBe(true);
    expect(r.user?.id).toBe(12345);
    expect(r.user?.username).toBe("ali");
  });

  it("rejects a tampered payload (hash no longer matches)", async () => {
    const initData = makeInitData({ authDate: fresh }) + "&extra=injected";
    const r = await validateInitData(initData, BOT_TOKEN, { nowMs: now });
    expect(r.valid).toBe(false);
    expect(r.reason).toBe("bad-hash");
  });

  it("rejects when signed with a different bot token", async () => {
    const initData = makeInitData({ authDate: fresh, token: "999:OTHER-token" });
    const r = await validateInitData(initData, BOT_TOKEN, { nowMs: now });
    expect(r.valid).toBe(false);
  });

  it("rejects a stale auth_date beyond maxAge", async () => {
    const initData = makeInitData({ authDate: Math.floor(now / 1000) - 90_000 });
    const r = await validateInitData(initData, BOT_TOKEN, { nowMs: now, maxAgeSeconds: 86_400 });
    expect(r.valid).toBe(false);
    expect(r.reason).toBe("expired");
  });

  it("rejects when there is no hash or no input", async () => {
    expect((await validateInitData("user=%7B%7D&auth_date=1", BOT_TOKEN, { nowMs: now })).valid).toBe(false);
    expect((await validateInitData("", BOT_TOKEN)).valid).toBe(false);
    expect((await validateInitData("x=1&hash=abc", "")).valid).toBe(false);
  });
});

describe("telegramLocale", () => {
  it("maps language codes to supported locales", () => {
    expect(telegramLocale("uz")).toBe("uz");
    expect(telegramLocale("en-US")).toBe("en");
    expect(telegramLocale("ru")).toBe("ru");
    expect(telegramLocale(undefined)).toBe("ru");
    expect(telegramLocale("fr")).toBe("ru");
  });
});
