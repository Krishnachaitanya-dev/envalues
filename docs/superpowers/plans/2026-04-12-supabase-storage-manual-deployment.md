# Supabase Storage Manual Deployment Note

Date: 2026-04-12

## Why This Exists

The Phase 3 media migration `supabase/migrations/20260412001000_chatbot_media_storage.sql` creates the `chatbot-media` bucket and Storage object policies.

On hosted Supabase, pasting the full migration into the SQL editor can fail with:

```text
ERROR: 42501: must be owner of relation objects
```

That happens because `storage.objects` is owned by Supabase-managed storage internals. Do not change ownership of `storage.objects`.

If the SQL editor fails, apply the bucket and policies through the Supabase Dashboard Storage UI instead.

## Bucket Setup

Create or update this bucket:

- Bucket name: `chatbot-media`
- Public: `true`
- Max file size: `50 MB`
- Allowed MIME types:
  - `image/jpeg`
  - `image/png`
  - `image/webp`
  - `image/gif`
  - `video/mp4`
  - `video/3gpp`
  - `application/pdf`

Security model:

- Writes are tenant-scoped by policy.
- Reads are public-by-URL.
- This is not private document storage.

## Owner Media Policies

Owner media path convention:

```text
owner_id/flows/flow_id/nodes/node_id/random_id.ext
```

The first path segment must exactly equal the authenticated owner id.

### Owner Insert Policy

Policy target:

- Bucket/table: `storage.objects`
- Operation: `INSERT`
- Role: `authenticated`
- Expression type: `WITH CHECK`

Expression:

```sql
bucket_id = 'chatbot-media'
AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
AND (storage.foldername(name))[2] = 'flows'
AND (storage.foldername(name))[3] IS NOT NULL
AND (storage.foldername(name))[4] = 'nodes'
AND (storage.foldername(name))[5] IS NOT NULL
AND storage.filename(name) ~ '^[A-Za-z0-9-]{8,}\.(jpg|jpeg|png|webp|gif|mp4|3gp|3gpp|pdf)$'
```

### Owner Update Policy

Policy target:

- Bucket/table: `storage.objects`
- Operation: `UPDATE`
- Role: `authenticated`
- Expression type: `USING`

Expression:

```sql
bucket_id = 'chatbot-media'
AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
AND (storage.foldername(name))[2] = 'flows'
AND (storage.foldername(name))[3] IS NOT NULL
AND (storage.foldername(name))[4] = 'nodes'
AND (storage.foldername(name))[5] IS NOT NULL
```

Policy target:

- Bucket/table: `storage.objects`
- Operation: `UPDATE`
- Role: `authenticated`
- Expression type: `WITH CHECK`

Expression:

```sql
bucket_id = 'chatbot-media'
AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
AND (storage.foldername(name))[2] = 'flows'
AND (storage.foldername(name))[3] IS NOT NULL
AND (storage.foldername(name))[4] = 'nodes'
AND (storage.foldername(name))[5] IS NOT NULL
AND storage.filename(name) ~ '^[A-Za-z0-9-]{8,}\.(jpg|jpeg|png|webp|gif|mp4|3gp|3gpp|pdf)$'
```

### Owner Delete Policy

Policy target:

- Bucket/table: `storage.objects`
- Operation: `DELETE`
- Role: `authenticated`
- Expression type: `USING`

Expression:

```sql
bucket_id = 'chatbot-media'
AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
AND (storage.foldername(name))[2] = 'flows'
AND (storage.foldername(name))[3] IS NOT NULL
AND (storage.foldername(name))[4] = 'nodes'
AND (storage.foldername(name))[5] IS NOT NULL
```

## Admin Brand Logo Policies

Admin brand logo path convention:

```text
brand-logos/file.ext
```

Use separate policies for this prefix. Do not combine owner media and admin logo rules into one broad policy.

For admin insert, update `USING`, update `WITH CHECK`, and delete, use:

```sql
bucket_id = 'chatbot-media'
AND (storage.foldername(name))[1] = 'brand-logos'
AND public.is_admin()
```

## Verification

After applying the bucket and policies:

1. Log in as a normal owner.
2. Open `/dashboard/builder`.
3. Select a message node.
4. Upload a small image.
5. Confirm the storage path looks like:
   `owner_id/flows/flow_id/nodes/node_id/random_id.ext`
6. Confirm the saved node config includes:
   `config.attachments[0].url`
   `config.attachments[0].storage_path`
7. Confirm another owner cannot upload to the first owner id path.
8. Confirm admins can still upload brand logos under `brand-logos/**`.

Local verification:

```powershell
npm test -- --run
npm run build
```

