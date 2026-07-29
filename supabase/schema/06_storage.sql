-- =========================================================
-- Rentora — Storage buckets + policies (complete)
-- =========================================================

-- Buckets
-- id                  public   file_size_limit   allowed_mime_types
-- verification-docs   false    (none)            (none)               -- legacy/unused, 0 files
-- property-images     true     (none)            (none)               -- 18 files
-- move-in-photos       true     (none)            (none)               -- 2 files
-- verification         false   10485760 (10MB)    image/jpeg, image/png, image/webp, application/pdf  -- 11 files
-- avatars              true     5242880 (5MB)     image/jpeg, image/png, image/webp                   -- user profile pictures

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('verification-docs', 'verification-docs', false, null, null),
  ('property-images', 'property-images', true, null, null),
  ('move-in-photos', 'move-in-photos', true, null, null),
  ('verification', 'verification', false, 10485760, array['image/jpeg','image/png','image/webp','application/pdf']),
  ('avatars', 'avatars', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

-- Storage policies (on storage.objects)
CREATE POLICY "Anyone can view property images" ON storage.objects FOR SELECT
  USING (bucket_id = 'property-images');

CREATE POLICY "Authenticated users can delete property images" ON storage.objects FOR DELETE
  USING (bucket_id = 'property-images');

CREATE POLICY "Authenticated users can upload property images" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'property-images');

CREATE POLICY "authenticated users can upload verification docs" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'verification');

CREATE POLICY "move_in_photos_insert" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'move-in-photos');

CREATE POLICY "move_in_photos_read" ON storage.objects FOR SELECT
  USING (bucket_id = 'move-in-photos');

CREATE POLICY "verification_docs_admin_read" ON storage.objects FOR SELECT
  USING (bucket_id = 'verification' AND is_admin());

CREATE POLICY "verification_docs_owner_read" ON storage.objects FOR SELECT
  USING (bucket_id = 'verification' AND owner = auth.uid());

CREATE POLICY "Anyone can view avatars" ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

CREATE POLICY "Authenticated users can upload avatars" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'avatars');

CREATE POLICY "Users can update their own avatar" ON storage.objects FOR UPDATE
  USING (bucket_id = 'avatars' AND owner = auth.uid());

CREATE POLICY "Users can delete their own avatar" ON storage.objects FOR DELETE
  USING (bucket_id = 'avatars' AND owner = auth.uid());
