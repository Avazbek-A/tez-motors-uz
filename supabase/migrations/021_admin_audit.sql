-- Phase V2: admin audit log.
--
-- A multi-user dealer now edits inventory, advances orders, and configures the
-- site — and since Phase T it takes deposits. There was no record of who
-- changed what, when. This table is an append-only trail: every privileged
-- write (create / update / delete / status change) writes one compact row with
-- a JSONB `diff` (changed fields only — never full rows, to keep it bounded).
--
-- SERVICE-ROLE-ONLY: RLS enabled, no policies. The anon key can neither read
-- nor write. The admin panel reads it through the service-role API route
-- (/api/admin/audit), gated by requireAdmin. Mirrors orders (017) / payments
-- (020) / customers (019).

CREATE TABLE IF NOT EXISTS public.admin_audit (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  -- Who. actor_admin_id is null for legacy sessions with no linked user.
  actor_admin_id UUID REFERENCES public.admin_users(id) ON DELETE SET NULL,
  actor_email TEXT,
  -- What. action: create | update | delete | status_change | restock | ...
  action TEXT NOT NULL,
  -- Which kind of thing: car | part | order | review | faq | post | user | settings | ...
  entity TEXT NOT NULL,
  entity_id TEXT,
  -- Changed fields only (compact), or the notable payload of the action.
  diff JSONB,
  ip TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_audit ENABLE ROW LEVEL SECURITY;
-- No policies on purpose: service-role only.

CREATE INDEX IF NOT EXISTS idx_admin_audit_created_at ON public.admin_audit (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_entity ON public.admin_audit (entity, entity_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_actor ON public.admin_audit (actor_admin_id);
