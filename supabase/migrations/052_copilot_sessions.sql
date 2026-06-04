-- Phase AE — Dealer Copilot conversational operations.
-- Kept SEPARATE from the customer assistant tables (assistant_conversations /
-- assistant_messages, migration 040) so dealer ops never pollute the customer
-- lead list, and so confirm-gated actions get their own payload/expiry columns.
-- Both tables are service-role-only (RLS enabled, NO policies) — the dealer
-- reaches them through requireAdmin routes or the operator-gated Telegram path.

-- Per-thread conversation memory for the copilot (web panel + Telegram operator).
create table if not exists public.copilot_messages (
  id          uuid primary key default gen_random_uuid(),
  thread_id   text not null,                 -- web: admin session/thread; tg: "tg:<chatId>"
  role        text not null check (role in ('user','assistant')),
  content     text not null,
  created_at  timestamptz not null default now()
);
create index if not exists copilot_messages_thread_idx
  on public.copilot_messages (thread_id, created_at);

-- Confirm-gated pending write actions. A WRITE intent first writes a row here
-- with the FULLY-RESOLVED target ids frozen in `payload`; the dealer's explicit
-- "yes"/Confirm flips it to confirmed and the executor runs the frozen payload —
-- it never re-parses the free-text reference.
create table if not exists public.copilot_pending_actions (
  id          uuid primary key default gen_random_uuid(),
  thread_id   text not null,
  intent      text not null,                 -- markdown_car | create_promo | advance_order | draft_po | send_channel_post
  payload     jsonb not null,                -- frozen, resolved params
  preview     text not null,                 -- human-readable summary shown before confirm
  status      text not null default 'proposed' check (status in ('proposed','confirmed','cancelled','expired')),
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null,
  resolved_at timestamptz
);
create index if not exists copilot_pending_thread_idx
  on public.copilot_pending_actions (thread_id, status, created_at desc);

alter table public.copilot_messages        enable row level security;
alter table public.copilot_pending_actions enable row level security;
-- No policies: service-role only (privileged dealer ops), mirroring orders/payments.
