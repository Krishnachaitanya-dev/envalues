import { readFileSync } from 'fs'
import { describe, expect, it } from 'vitest'

const sql = readFileSync('supabase/migrations/20260412001000_chatbot_media_storage.sql', 'utf-8')

describe('chatbot media storage migration contract', () => {
  it('creates the shared public chatbot-media bucket with size and MIME limits', () => {
    expect(sql).toContain("'chatbot-media'")
    expect(sql).toContain('public')
    expect(sql).toContain('52428800')
    expect(sql).toContain("'image/jpeg'")
    expect(sql).toContain("'video/mp4'")
    expect(sql).toContain("'application/pdf'")
  })

  it('uses exact owner path segment policies for flow media', () => {
    expect(sql).toContain("(storage.foldername(name))[1] = (SELECT auth.uid())::text")
    expect(sql).toContain("(storage.foldername(name))[2] = 'flows'")
    expect(sql).toContain("(storage.foldername(name))[4] = 'nodes'")
    expect(sql).toContain('storage.filename(name)')
  })

  it('keeps admin brand-logo policies separate from owner media policies', () => {
    expect(sql).toContain('chatbot_media_admin_brand_logo_insert')
    expect(sql).toContain("(storage.foldername(name))[1] = 'brand-logos'")
    expect(sql).toContain('public.is_admin()')
  })

  it('warns that hosted SQL editor may not own storage.objects policies', () => {
    expect(sql).toContain('ERROR 42501: must be owner of relation objects')
    expect(sql).toContain('Do not change ownership of Supabase-managed storage tables')
    expect(sql).toContain('2026-04-12-supabase-storage-manual-deployment.md')
  })
})
