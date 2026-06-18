-- Migration: Private storage bucket for sensitive call recordings.
-- No policies are created on purpose; access is service-role only.

INSERT INTO storage.buckets (id, name, public)
VALUES ('call-recordings', 'call-recordings', false)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    name = EXCLUDED.name;
