-- ============================================================
-- Run this AFTER schema.sql in Supabase SQL editor
-- ============================================================

-- ── RPC: increment runs used ──────────────────────────────
create or replace function public.increment_runs(p_user_id uuid)
returns void language plpgsql security definer as $$
begin
  update public.users
  set runs_used = runs_used + 1
  where id = p_user_id;
end;
$$;

-- ── Storage bucket ────────────────────────────────────────
-- Run via Supabase Dashboard > Storage > New bucket
-- Name: carousel-images
-- Public: true (so image URLs work without auth)
-- File size limit: 5MB
-- Allowed MIME types: image/png, image/jpeg, image/webp

-- ── Storage RLS ───────────────────────────────────────────
-- Allow service role (used by Netlify functions) to upload
-- Allow public read of all images (bucket is public)

-- After creating the bucket, run:
create policy "service_role_upload" on storage.objects
  for insert to service_role
  with check (bucket_id = 'carousel-images');

create policy "public_read" on storage.objects
  for select to public
  using (bucket_id = 'carousel-images');

-- ── Add generation tracking columns to sessions ───────────
-- (Run this after schema.sql if you already ran that migration)
alter table public.sessions
  add column if not exists generation_stage text,
  add column if not exists generation_error text;

-- ── Enable Realtime on carousels table ────────────────────
-- In Supabase Dashboard > Database > Replication:
-- Toggle on the 'carousels' table under supabase_realtime publication.
-- Or run:
alter publication supabase_realtime add table public.carousels;
