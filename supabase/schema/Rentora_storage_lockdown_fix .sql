-- ============================================================
-- Rentora — storage lockdown fix (run once in Supabase SQL Editor)
-- Fixes:
--   1. move-in-photos: currently public + world-readable → make
--      private, add owner/admin-only read (mirrors `verification`)
--   2. ads: currently anyone (incl. anonymous) can upload → require
--      an authenticated user
-- Safe to re-run: uses IF EXISTS / DROP+CREATE for policies.
-- ============================================================

-- 1a. Make move-in-photos private
update storage.buckets
set public = false
where id = 'move-in-photos';

-- 1b. Add read access: file owner or admin only
drop policy if exists "move_in_photos_owner_read" on storage.objects;
create policy "move_in_photos_owner_read"
on storage.objects for select
to authenticated
using (bucket_id = 'move-in-photos' and owner = auth.uid());

drop policy if exists "move_in_photos_admin_read" on storage.objects;
create policy "move_in_photos_admin_read"
on storage.objects for select
to authenticated
using (bucket_id = 'move-in-photos' and is_admin());

-- NOTE: if move-in photos need to be visible to BOTH the tenant and the
-- agent/property owner (not just whoever uploaded it), tell me and I'll
-- extend the USING clause to join against `properties`/`inspections`
-- instead of just checking owner = auth.uid().

-- 2. Require authentication to upload ad images (close anonymous upload gap)
drop policy if exists "Anyone can upload ad images" on storage.objects;
create policy "Authenticated users can upload ad images"
on storage.objects for insert
to authenticated
with check (bucket_id = 'ads' and auth.uid() is not null);

-- ============================================================
-- Verification queries — run after the above to confirm the fix
-- ============================================================
select id, public from storage.buckets where id = 'move-in-photos';

select policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'storage' and qual::text ilike '%move-in-photos%' or with_check::text ilike '%move-in-photos%';

select policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'storage' and (qual::text ilike '%ads%' or with_check::text ilike '%ads%');