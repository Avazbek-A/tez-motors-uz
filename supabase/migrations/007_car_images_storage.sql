-- Public storage bucket for car images.

INSERT INTO storage.buckets (id, name, public)
VALUES ('car-images', 'car-images', true)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    name = EXCLUDED.name;

DROP POLICY IF EXISTS "Public can view car images" ON storage.objects;
CREATE POLICY "Public can view car images"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'car-images');

