-- 094_expert_blog_enhancements.sql
--
-- Setup the E-E-A-T authors table, link posts, and add SEO fields.

-- 1. Create blog_authors table
CREATE TABLE IF NOT EXISTS public.blog_authors (
  id UUID PRIMARY KEY REFERENCES public.admin_users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  avatar_url TEXT,
  bio_ru TEXT,
  bio_uz TEXT,
  bio_en TEXT,
  twitter TEXT,
  linkedin TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on authors
ALTER TABLE public.blog_authors ENABLE ROW LEVEL SECURITY;

-- Anyone can read author public bios
DROP POLICY IF EXISTS "blog_authors_public_read" ON public.blog_authors;
CREATE POLICY "blog_authors_public_read"
  ON public.blog_authors FOR SELECT
  USING (true);

-- NO write policy on purpose. All blog writes go through the service-role client
-- (createServiceClient), which BYPASSES RLS. A `FOR ALL USING(true) WITH CHECK(true)`
-- policy would instead let the PUBLIC anon key (shipped in the client bundle)
-- insert/update/delete author bios — a defacement vector. Service-role only.
DROP POLICY IF EXISTS "blog_authors_admin_all" ON public.blog_authors;

-- 2. Add new fields to posts
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS read_time_minutes INTEGER,
  ADD COLUMN IF NOT EXISTS meta_title_ru TEXT,
  ADD COLUMN IF NOT EXISTS meta_title_uz TEXT,
  ADD COLUMN IF NOT EXISTS meta_title_en TEXT,
  ADD COLUMN IF NOT EXISTS meta_description_ru TEXT,
  ADD COLUMN IF NOT EXISTS meta_description_uz TEXT,
  ADD COLUMN IF NOT EXISTS meta_description_en TEXT;

-- 3. Point posts.author_id constraint to blog_authors(id) instead of admin_users(id)
-- Note: blog_authors(id) references admin_users(id) 1-to-1, so this is valid.
ALTER TABLE public.posts
  DROP CONSTRAINT IF EXISTS posts_author_id_fkey;

ALTER TABLE public.posts
  ADD CONSTRAINT posts_author_id_fkey
  FOREIGN KEY (author_id)
  REFERENCES public.blog_authors(id)
  ON DELETE SET NULL;

-- 4. Auto-create author record for any new admin users
CREATE OR REPLACE FUNCTION public.handle_new_admin_author()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.blog_authors (id, name, bio_ru, bio_uz, bio_en)
  VALUES (
    NEW.id,
    split_part(NEW.email, '@', 1),
    'Эксперт Tez Motors',
    'Tez Motors eksperti',
    'Tez Motors Expert'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_admin_user_created ON public.admin_users;
CREATE TRIGGER on_admin_user_created
  AFTER INSERT ON public.admin_users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_admin_author();

-- 5. Backfill blog_authors for existing admin_users
INSERT INTO public.blog_authors (id, name, bio_ru, bio_uz, bio_en)
SELECT id, split_part(email, '@', 1), 'Эксперт Tez Motors', 'Tez Motors eksperti', 'Tez Motors Expert'
FROM public.admin_users
ON CONFLICT (id) DO NOTHING;
