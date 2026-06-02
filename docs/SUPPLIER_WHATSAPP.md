# Automating supplier conversations on WhatsApp

The buying side of the business — talking to Chinese suppliers (Alibaba / 1688 /
WhatsApp) — is where a lot of repetitive typing and translating happens. This
documents what we automate, what we *can't* safely automate, and the upgrade
paths if you want to go further.

## What ships today (safe, no ban risk)

On **Admin → Procurement**, open any purchase order. The **Supplier WhatsApp
message** panel:

1. Pick an intent — **Request quote**, **Follow up**, **Shipping / ETA**, or
   **Price check**.
2. Click **Draft** — the system writes a short, professional **bilingual
   (中文 + English)** message, grounded on that PO's car, quantity, and ETA. It
   never quotes your internal cost back to the supplier and never invents specs.
3. Edit the draft if you want, then click **Send on WhatsApp** — this opens
   WhatsApp (app or web) with the message pre-filled to the supplier's number
   (`supplier_phone` on the PO). You press send.

This automates the **thinking and writing** — the actual time-sink — while *you*
stay on the send button. It uses the same AI drafting (`src/lib/supplier-ai.ts`,
fail-open to a clean template if `LLM_API_KEY` is unset) as the customer-reply
drafter, applied to the buy side. No new infrastructure, no risk to your number.

## Why we don't fully auto-send (the honest ceiling)

There are only two ways a program can send WhatsApp messages, and neither lets a
bot freely *initiate and negotiate* with your suppliers:

- **Official WhatsApp Business Cloud API** (what the *customer-facing* bot at
  `/api/bot/whatsapp` uses). A business may send free-form messages **only inside
  a 24-hour window after the other party messages first**. Outside that window
  you can send **pre-approved template messages only**. It's designed for
  replying to customers, not for proactively chatting up your own suppliers. So
  autonomous outbound supplier conversation isn't possible within the rules.
- **Unofficial automation** (libraries like `whatsapp-web.js` / Baileys that
  drive a real WhatsApp account). These *can* free-form two-way automate — but
  they **violate WhatsApp's Terms and routinely get numbers banned**, can't run
  on Cloudflare Workers (they need a long-lived Node process + a stored login
  session), and handing price negotiation to an unsupervised bot is risky.

For a B2B relationship where trust and price matter, **human-in-the-loop is the
right design**, not a limitation to engineer around.

## Optional upgrade paths (only if you want them)

### A. One-tap templated outreach (no code, no risk)
You already have it — the Draft + Send flow above. Save your common asks as PO
"intents"; the wa.me deep link does the rest. This covers ~90% of supplier
messaging value.

### B. Self-hosted WhatsApp bridge on your Vostro (power-user, ToS risk)
If you want the app to *actually* send/receive without pressing send, run a small
Node service (`whatsapp-web.js`) on your Ubuntu box that:
- holds the WhatsApp Web session (QR-login once),
- exposes a local HTTP endpoint the site can POST a `{ phone, text }` to,
- forwards inbound supplier replies to a webhook so they can be logged/auto-drafted.

The app side is ready to plug in: add a `SUPPLIER_WA_BRIDGE_URL` env and a thin
`sendSupplierMessage()` that POSTs to it (fail-open, exactly like `telegram.ts`).
**Risks to accept first:** use a dedicated number you can afford to lose, expect
possible bans, keep a human reviewing anything the AI would send. This is *not*
recommended unless message volume genuinely justifies it.

### C. Dealer follow-up nudges (safe, additive)
A cron can scan POs stuck in `ordered` / `in_production` / `shipped` with no
update for N days and send **you** (not the supplier) a digest with a ready-to-go
follow-up draft per PO — so nothing slips, and you still send. This reuses the
existing cron + `notify` infrastructure. Ask to have it wired if useful.

## Where the supplier's number comes from
Each purchase order has a **Supplier WhatsApp** field (`supplier_phone`, e.g.
`+8613800138000`). The Send link strips non-digits and builds `https://wa.me/<digits>?text=…`.
If a PO has no number, the link opens WhatsApp's share sheet so you can pick the
chat manually.
