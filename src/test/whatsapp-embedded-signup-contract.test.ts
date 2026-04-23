import { readFileSync } from 'fs'
import { describe, expect, it } from 'vitest'

const migration = readFileSync('supabase/migrations/20260423010000_whatsapp_embedded_signup_sessions.sql', 'utf-8')
const startFn = readFileSync('supabase/functions/whatsapp-embedded-start/index.ts', 'utf-8')
const completeFn = readFileSync('supabase/functions/whatsapp-embedded-complete/index.ts', 'utf-8')
const dashboardData = readFileSync('src/hooks/useDashboardData.ts', 'utf-8')
const settings = readFileSync('src/components/dashboard/settings/SettingsPage.tsx', 'utf-8')
const overview = readFileSync('src/components/dashboard/overview/OverviewPage.tsx', 'utf-8')
const appRoutes = readFileSync('src/App.tsx', 'utf-8')

describe('whatsapp embedded signup contract', () => {
  it('adds connect session table for tenant-bound state integrity', () => {
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.whatsapp_connect_sessions')
    expect(migration).toContain('status IN (\'pending\', \'completed\', \'expired\', \'cancelled\')')
    expect(migration).toContain('state            text NOT NULL UNIQUE')
    expect(migration).toContain('expires_at       timestamptz NOT NULL')
    expect(migration).toContain('ALTER TABLE public.whatsapp_connect_sessions ENABLE ROW LEVEL SECURITY;')
  })

  it('exposes start function with oauth_url and short-lived session state', () => {
    expect(startFn).toContain('whatsapp_connect_sessions')
    expect(startFn).toContain('const SESSION_TTL_MINUTES = 10')
    expect(startFn).toContain('META_EMBEDDED_SIGNUP_CONFIG_ID')
    expect(startFn).toContain('oauth_url')
  })

  it('completes connect flow with state validation and replace confirmation gate', () => {
    expect(completeFn).toContain("from('whatsapp_connect_sessions')")
    expect(completeFn).toContain("if (connectSession.status !== 'pending')")
    expect(completeFn).toContain("error_code: 'replace_confirmation_required'")
    expect(completeFn).toContain("upsert(accountPayload, { onConflict: 'owner_id' })")
    expect(completeFn).toContain("from('whatsapp_account_events')")
    expect(completeFn).toContain("from('audit_logs')")
  })

  it('wires dashboard CTA and popup completion handlers with manual fallback retained', () => {
    expect(dashboardData).toContain("invokeAuthedFunction<{ oauth_url: string }>('whatsapp-embedded-start'")
    expect(dashboardData).toContain("window.confirm('An existing WhatsApp configuration is already saved for this account. Replace it with the new Facebook connection?')")
    expect(settings).toContain('Connect with Facebook')
    expect(settings).toContain('Reconnect with Facebook')
    expect(overview).toContain('Connect with Facebook to activate WhatsApp')
    expect(appRoutes).toContain('/whatsapp/embedded-callback')
  })
})
