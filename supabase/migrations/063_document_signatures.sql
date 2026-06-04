-- Phase AR — e-signature on order documents.
--
-- Closes the last offline step: the deposit is paid online but the sales
-- contract / deposit agreement was signed on paper. A customer-facing sign flow
-- (gated by reference_code + phone, like /track) records a click-to-sign:
-- typed name + agreement + timestamp + IP, with an optional drawn signature.
--
-- Service-role only (RLS enabled, no policies) — it's evidence of consent on a
-- money document; the public sign route writes it via the service client after
-- verifying code + phone.

create table if not exists public.document_signatures (
  id              uuid primary key default gen_random_uuid(),
  order_id        uuid references public.orders(id) on delete cascade,
  document_type   text not null,
  signer_name     text not null,
  signer_phone    text not null,
  signature_text  text,           -- typed full name (the click-to-sign method)
  signature_image text,           -- optional drawn signature (data URL, size-capped at write)
  agreed          boolean not null default true,
  ip              text,
  user_agent      text,
  signed_at       timestamptz not null default now()
);
create index if not exists document_signatures_order_idx on public.document_signatures (order_id, signed_at desc);

alter table public.document_signatures enable row level security;
-- No policies: service-role only.
