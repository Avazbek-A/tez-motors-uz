-- Public storage bucket for part images. Mirrors car-images (007).

INSERT INTO storage.buckets (id, name, public)
VALUES ('part-images', 'part-images', true)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    name = EXCLUDED.name;

DROP POLICY IF EXISTS "Public can view part images" ON storage.objects;
CREATE POLICY "Public can view part images"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'part-images');
