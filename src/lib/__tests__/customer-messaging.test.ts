import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock the channel primitives so we can assert routing without network.
const sendBotMessage = vi.fn();
const sendPushToMany = vi.fn();
const sendEmail = vi.fn();

vi.mock("../telegram", () => ({ sendBotMessage: (...a: unknown[]) => sendBotMessage(...a) }));
vi.mock("../push", () => ({ sendPushToMany: (...a: unknown[]) => sendPushToMany(...a) }));
vi.mock("../email", () => ({ sendEmail: (...a: unknown[]) => sendEmail(...a) }));

import { sendToCustomer } from "../customer-messaging";

// Minimal Supabase stub: push_subscriptions returns one sub; notification_log insert is a no-op.
function fakeSupabase() {
  return {
    from(table: string) {
      if (table === "push_subscriptions") {
        return {
          select: () => ({
            eq: () => Promise.resolve({ data: [{ id: "s1", endpoint: "https://fcm.googleapis.com/x", p256dh: "p", auth: "a" }] }),
          }),
        };
      }
      // notification_log
      return { insert: () => Promise.resolve({ error: null }) };
    },
  } as never;
}

const MSG = {
  title: "На таможне",
  body: "BYD Song Plus: статус обновлён",
  url: "/ru/track",
  buttonLabel: "Отследить",
  email: { subject: "s", html: "<p>h</p>" },
  pushTag: "order-status",
  kind: "order_status",
};

describe("sendToCustomer — chat-first routing", () => {
  beforeEach(() => {
    sendBotMessage.mockReset();
    sendPushToMany.mockReset();
    sendEmail.mockReset();
    sendBotMessage.mockResolvedValue({ ok: true });
    sendPushToMany.mockResolvedValue({ sent: 1, pruned: 0 });
    sendEmail.mockResolvedValue({ ok: true });
  });

  it("auto: a delivered Telegram DM suppresses push + email", async () => {
    const r = await sendToCustomer(fakeSupabase(), { id: "c1", telegram_id: 123, email: "a@b.co" }, MSG);
    expect(sendBotMessage).toHaveBeenCalledOnce();
    expect(sendPushToMany).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
    expect(r).toMatchObject({ telegram: true, push: false, email: false, delivered: true });
  });

  it("auto: no telegram_id falls back to push + email", async () => {
    const r = await sendToCustomer(fakeSupabase(), { id: "c1", telegram_id: null, email: "a@b.co" }, MSG);
    expect(sendBotMessage).not.toHaveBeenCalled();
    expect(sendPushToMany).toHaveBeenCalledOnce();
    expect(sendEmail).toHaveBeenCalledOnce();
    expect(r.delivered).toBe(true);
  });

  it("auto: a failed Telegram DM falls back to push + email", async () => {
    sendBotMessage.mockResolvedValue({ ok: false });
    const r = await sendToCustomer(fakeSupabase(), { id: "c1", telegram_id: 123, email: "a@b.co" }, MSG);
    expect(sendBotMessage).toHaveBeenCalledOnce();
    expect(sendPushToMany).toHaveBeenCalledOnce();
    expect(sendEmail).toHaveBeenCalledOnce();
    expect(r).toMatchObject({ telegram: false, delivered: true });
  });

  it("explicit channel='email' uses only email even when telegram_id present", async () => {
    const r = await sendToCustomer(
      fakeSupabase(),
      { id: "c1", telegram_id: 123, email: "a@b.co", notify_channel: "email" },
      MSG,
    );
    expect(sendBotMessage).not.toHaveBeenCalled();
    expect(sendPushToMany).not.toHaveBeenCalled();
    expect(sendEmail).toHaveBeenCalledOnce();
    expect(r).toMatchObject({ email: true, telegram: false, push: false });
  });

  it("email is skipped when no template is supplied", async () => {
    const r = await sendToCustomer(fakeSupabase(), { id: "c1", email: "a@b.co" }, { ...MSG, email: null });
    expect(sendEmail).not.toHaveBeenCalled();
    // push still fires (has id), so delivered via push
    expect(r.email).toBe(false);
  });
});
