import { readFileSync } from 'fs'
import { describe, expect, it } from 'vitest'

const migration = readFileSync('supabase/migrations/20260412000000_flow_template_catalog.sql', 'utf-8')
const inputCaptureMigration = readFileSync('supabase/migrations/20260414000000_flow_template_input_capture.sql', 'utf-8')

describe('flow template migration contract', () => {
  it('adds provenance, catalog, idempotency, trigger normalization, and RPC', () => {
    expect(migration).toContain('created_from_template_id')
    expect(migration).toContain('created_from_template_version')
    expect(migration).toContain('template_applied_at')
    expect(migration).toContain('template_request_id')
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.flow_template_catalog')
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.flow_template_applications')
    expect(migration).toContain('normalized_trigger_value')
    expect(migration).toContain('instantiate_flow_template')
    expect(migration).toContain('UNIQUE(owner_id, request_id)')
  })

  it('seeds all required stock templates', () => {
    const required = [
      'clinic_doctor_appointment',
      'restaurant_cafe',
      'ecommerce_store',
      'salon_spa',
      'real_estate_leads',
      'education_coaching',
      'gym_fitness_studio',
      'hotel_homestay',
      'travel_agency',
      'insurance_finance',
      'automotive_service',
      'general_business',
    ]

    for (const id of required) {
      expect(migration).toContain(id)
    }
  })

  it('documents stable RPC error codes', () => {
    for (const code of ['TEMPLATE_NOT_FOUND', 'TEMPLATE_INVALID', 'TRIGGER_CONFLICT', 'PERMISSION_DENIED', 'IDEMPOTENCY_CONFLICT', 'DB_WRITE_FAILED']) {
      expect(migration).toContain(code)
    }
  })

  it('updates stock templates so collection prompts pause for user input before handoff', () => {
    expect(inputCaptureMigration).toContain('build_stock_flow_template_v2')
    expect(inputCaptureMigration).toContain("'type', 'input'")
    expect(inputCaptureMigration).toContain("'store_as', 'secondary_response'")
    expect(inputCaptureMigration).toContain("CASE WHEN p_secondary_collect THEN 'handoff' ELSE 'end' END")
    expect(inputCaptureMigration).toContain('gym_fitness_studio')
    expect(inputCaptureMigration).toContain('Trial Session')
  })
})
