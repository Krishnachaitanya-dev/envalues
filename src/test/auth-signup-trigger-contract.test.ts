import { readFileSync } from 'fs'
import { describe, expect, it } from 'vitest'

const migration = readFileSync('supabase/migrations/20260419000000_remove_legacy_chatbot_signup.sql', 'utf-8')

describe('auth signup trigger contract', () => {
  it('creates only owner rows for new auth users', () => {
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.handle_new_user()')
    expect(migration).toContain('INSERT INTO public.owners')
    expect(migration).not.toContain('INSERT INTO public.chatbots')
    expect(migration).toContain('ON CONFLICT (id) DO UPDATE')
  })
})
