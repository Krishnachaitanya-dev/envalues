-- Phase 3: shared public media bucket with tenant-scoped writes.
-- Security model: writes are tenant-scoped; reads are public-by-URL.
--
-- Deployment note:
-- Supabase-hosted SQL editor may fail on the storage.objects policy statements
-- with: ERROR 42501: must be owner of relation objects.
-- Do not change ownership of Supabase-managed storage tables to work around it.
-- If this role error occurs, keep this file as the CLI/admin migration source of
-- truth and apply the bucket + object policies through Supabase Dashboard
-- Storage policy UI using docs/superpowers/plans/2026-04-12-supabase-storage-manual-deployment.md.

INSERT INTO storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
VALUES (
  'chatbot-media',
  'chatbot-media',
  true,
  52428800,
  ARRAY[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'video/mp4',
    'video/3gpp',
    'application/pdf'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "chatbot_media_owner_insert" ON storage.objects;
DROP POLICY IF EXISTS "chatbot_media_owner_update" ON storage.objects;
DROP POLICY IF EXISTS "chatbot_media_owner_delete" ON storage.objects;
DROP POLICY IF EXISTS "chatbot_media_admin_brand_logo_insert" ON storage.objects;
DROP POLICY IF EXISTS "chatbot_media_admin_brand_logo_update" ON storage.objects;
DROP POLICY IF EXISTS "chatbot_media_admin_brand_logo_delete" ON storage.objects;

-- Owner flow media path:
-- {owner_id}/flows/{flow_id}/nodes/{node_id}/{random_id}.{ext}
-- The first path segment must exactly match auth.uid(); no loose prefix checks.
CREATE POLICY "chatbot_media_owner_insert" ON storage.objects
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'chatbot-media'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
    AND (storage.foldername(name))[2] = 'flows'
    AND (storage.foldername(name))[3] IS NOT NULL
    AND (storage.foldername(name))[4] = 'nodes'
    AND (storage.foldername(name))[5] IS NOT NULL
    AND storage.filename(name) ~ '^[A-Za-z0-9-]{8,}\.(jpg|jpeg|png|webp|gif|mp4|3gp|3gpp|pdf)$'
  );

CREATE POLICY "chatbot_media_owner_update" ON storage.objects
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (
    bucket_id = 'chatbot-media'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
    AND (storage.foldername(name))[2] = 'flows'
    AND (storage.foldername(name))[3] IS NOT NULL
    AND (storage.foldername(name))[4] = 'nodes'
    AND (storage.foldername(name))[5] IS NOT NULL
  )
  WITH CHECK (
    bucket_id = 'chatbot-media'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
    AND (storage.foldername(name))[2] = 'flows'
    AND (storage.foldername(name))[3] IS NOT NULL
    AND (storage.foldername(name))[4] = 'nodes'
    AND (storage.foldername(name))[5] IS NOT NULL
    AND storage.filename(name) ~ '^[A-Za-z0-9-]{8,}\.(jpg|jpeg|png|webp|gif|mp4|3gp|3gpp|pdf)$'
  );

CREATE POLICY "chatbot_media_owner_delete" ON storage.objects
  AS PERMISSIVE FOR DELETE TO authenticated
  USING (
    bucket_id = 'chatbot-media'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
    AND (storage.foldername(name))[2] = 'flows'
    AND (storage.foldername(name))[3] IS NOT NULL
    AND (storage.foldername(name))[4] = 'nodes'
    AND (storage.foldername(name))[5] IS NOT NULL
  );

-- Admin brand logos stay under a separate prefix and separate policies.
CREATE POLICY "chatbot_media_admin_brand_logo_insert" ON storage.objects
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'chatbot-media'
    AND (storage.foldername(name))[1] = 'brand-logos'
    AND public.is_admin()
  );

CREATE POLICY "chatbot_media_admin_brand_logo_update" ON storage.objects
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (
    bucket_id = 'chatbot-media'
    AND (storage.foldername(name))[1] = 'brand-logos'
    AND public.is_admin()
  )
  WITH CHECK (
    bucket_id = 'chatbot-media'
    AND (storage.foldername(name))[1] = 'brand-logos'
    AND public.is_admin()
  );

CREATE POLICY "chatbot_media_admin_brand_logo_delete" ON storage.objects
  AS PERMISSIVE FOR DELETE TO authenticated
  USING (
    bucket_id = 'chatbot-media'
    AND (storage.foldername(name))[1] = 'brand-logos'
    AND public.is_admin()
  );
