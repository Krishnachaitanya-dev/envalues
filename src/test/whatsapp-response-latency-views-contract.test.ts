import { readFileSync } from 'fs'
import { describe, expect, it } from 'vitest'

const latencyViewsMigration = readFileSync(
  'supabase/migrations/20260423040000_whatsapp_response_latency_views.sql',
  'utf-8',
)

describe('whatsapp response latency telemetry contract', () => {
  it('creates per-owner 24h latency view with p50/p95 metrics', () => {
    expect(latencyViewsMigration).toContain('CREATE OR REPLACE VIEW public.whatsapp_response_latency_owner_24h')
    expect(latencyViewsMigration).toContain('percentile_cont(0.50)')
    expect(latencyViewsMigration).toContain('percentile_cont(0.95)')
    expect(latencyViewsMigration).toContain('GROUP BY owner_id')
  })

  it('creates global 24h latency view', () => {
    expect(latencyViewsMigration).toContain('CREATE OR REPLACE VIEW public.whatsapp_response_latency_global_24h')
    expect(latencyViewsMigration).toContain("created_at >= now() - interval '24 hours'")
  })
})
