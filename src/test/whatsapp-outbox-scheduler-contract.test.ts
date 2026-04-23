import { readFileSync } from 'fs'
import { describe, expect, it } from 'vitest'

const schedulerMigration = readFileSync(
  'supabase/migrations/20260423030000_whatsapp_outbox_scheduler_and_ops_health.sql',
  'utf-8',
)

describe('whatsapp outbox scheduler contract', () => {
  it('schedules process-whatsapp-outbox every minute with run_seconds=60', () => {
    expect(schedulerMigration).toContain('process-whatsapp-outbox-every-minute')
    expect(schedulerMigration).toContain('* * * * *')
    expect(schedulerMigration).toContain('process-whatsapp-outbox?run_seconds=60')
  })

  it('adds a lightweight ops health view for queue/account triage', () => {
    expect(schedulerMigration).toContain('CREATE OR REPLACE VIEW public.whatsapp_ops_health')
    expect(schedulerMigration).toContain('pending_jobs')
    expect(schedulerMigration).toContain('dead_letter_jobs')
    expect(schedulerMigration).toContain('account_status')
  })
})
