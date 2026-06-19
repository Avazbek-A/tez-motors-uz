-- 095_posts_faqs.sql
--
-- Add a JSONB column to posts for localized FAQs.
--

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS faqs JSONB DEFAULT '[]'::jsonb;
