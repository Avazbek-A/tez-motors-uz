-- 004_drop_public_insert_policies.sql
-- All writes route through Next.js API endpoints using the service role key,
-- which bypasses RLS. The public anon role no longer needs ANY direct-write
-- access, including inquiry / review submission.
--
-- After this migration:
--   public role       -> SELECT only, limited to published/available rows
--   service_role      -> full access (used by server-side API routes only)

DROP POLICY IF EXISTS "Anyone can submit inquiries" ON public.inquiries;
DROP POLICY IF EXISTS "Allow insert reviews" ON public.reviews;
