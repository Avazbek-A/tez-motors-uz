-- 002_tighten_rls.sql
-- Lock down RLS so the public anon key (exposed in the JS bundle) cannot
-- read PII or mutate core tables. Admin routes use service_role, which
-- bypasses RLS entirely, so no explicit admin policies are needed.

-- Drop permissive policies that currently allow anyone with the anon key
-- to insert/update/delete core content and read every inquiry.

DROP POLICY IF EXISTS "Allow delete cars" ON public.cars;
DROP POLICY IF EXISTS "Allow insert cars" ON public.cars;
DROP POLICY IF EXISTS "Allow update cars" ON public.cars;
DROP POLICY IF EXISTS "Allow read all cars admin" ON public.cars;

DROP POLICY IF EXISTS "Allow delete faqs" ON public.faqs;
DROP POLICY IF EXISTS "Allow insert faqs" ON public.faqs;
DROP POLICY IF EXISTS "Allow update faqs" ON public.faqs;
DROP POLICY IF EXISTS "Allow read all faqs" ON public.faqs;

DROP POLICY IF EXISTS "Allow delete reviews" ON public.reviews;
DROP POLICY IF EXISTS "Allow update reviews" ON public.reviews;
DROP POLICY IF EXISTS "Allow read all reviews" ON public.reviews;

DROP POLICY IF EXISTS "Allow delete inquiries" ON public.inquiries;
DROP POLICY IF EXISTS "Allow read inquiries" ON public.inquiries;
DROP POLICY IF EXISTS "Allow update inquiries" ON public.inquiries;

-- Public SELECT policies are retained as-is:
--   cars:    "Anyone can view available cars"  (is_available = true)
--   faqs:    "Anyone can view published faqs"  (is_published = true)
--   reviews: "Anyone can view published reviews" (is_published = true)
--
-- Public INSERT policies retained so forms continue to work:
--   inquiries: "Anyone can submit inquiries" (WITH CHECK true)
--   reviews:   "Allow insert reviews"        (WITH CHECK true)
--
-- Public review INSERTs are force-moderated at the API layer
-- (src/app/api/reviews/route.ts overrides is_published=false).
