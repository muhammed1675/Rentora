-- =========================================================
-- Rentora — Storage bucket lockdown
--
-- PROBLEM: none of the storage.objects policies in 06_storage.sql
-- have a `TO authenticated` clause or an `auth.uid()` check, despite
-- names like "Authenticated users can upload avatars". In Postgres
-- RLS, a policy with no `TO` clause applies to EVERY role — including
-- `anon`. Combined with property-images and move-in-photos having no
-- file_size_limit or allowed_mime_types at all, this means as
-- currently written:
--
--   - anyone holding just the public anon key (no login required) can
--     upload arbitrary files — any type, any size — to property-images,
--     move-in-photos, and avatars
--   - anyone holding just the anon key can DELETE every property image
--     on the platform (the delete policy has no owner check at all)
--
-- This migration:
--   1. Adds file_size_limit + allowed_mime_types to the two buckets
--      that had none (property-images, move-in-photos)
--   2. Drops and recreates INSERT policies to require auth.uid() IS
--      NOT NULL (i.e. TO authenticated, effectively)
--   3. Scopes the property-images DELETE policy to the uploader or an
--      admin, instead of "anyone"
--   4. Adds the same auth.uid() requirement to the verification bucket's
--      INSERT policy, which had the identical gap
--
-- Every upload path in the app (AgentDashboard, VerifyAccount, Profile)
-- already only runs after login, so this doesn't change any legitimate
-- behavior — it just closes the door for anonymous requests hitting the
-- Supabase REST API directly.
--
-- Safe to re-run: DROP POLICY IF EXISTS + CREATE POLICY pattern.
-- =========================================================

-- ── 1. Bucket-level limits ──────────────────────────────
UPDATE storage.buckets
SET file_size_limit = 10485760, -- 10MB
    allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp']
WHERE id = 'property-images';

UPDATE storage.buckets
SET file_size_limit = 10485760, -- 10MB
    allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp']
WHERE id = 'move-in-photos';

-- ── 2. property-images ──────────────────────────────────
DROP POLICY IF EXISTS "Authenticated users can upload property images" ON storage.objects;
CREATE POLICY "Authenticated users can upload property images" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'property-images' AND auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can delete property images" ON storage.objects;
CREATE POLICY "Authenticated users can delete property images" ON storage.objects FOR DELETE
  USING (bucket_id = 'property-images' AND (owner = auth.uid() OR is_admin()));

-- ── 3. move-in-photos ────────────────────────────────────
DROP POLICY IF EXISTS "move_in_photos_insert" ON storage.objects;
CREATE POLICY "move_in_photos_insert" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'move-in-photos' AND auth.uid() IS NOT NULL);

-- ── 4. avatars ───────────────────────────────────────────
DROP POLICY IF EXISTS "Authenticated users can upload avatars" ON storage.objects;
CREATE POLICY "Authenticated users can upload avatars" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'avatars' AND auth.uid() IS NOT NULL);

-- ── 5. verification (docs) ───────────────────────────────
DROP POLICY IF EXISTS "authenticated users can upload verification docs" ON storage.objects;
CREATE POLICY "authenticated users can upload verification docs" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'verification' AND auth.uid() IS NOT NULL);

-- Sanity check: run this after applying to confirm no policy touching
-- storage.objects is missing a role/auth restriction on INSERT/DELETE.
--
-- SELECT policyname, cmd, qual, with_check
-- FROM pg_policies
-- WHERE schemaname = 'storage' AND tablename = 'objects'
-- ORDER BY policyname;
