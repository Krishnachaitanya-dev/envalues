import { readFileSync } from 'fs'
import { describe, expect, it } from 'vitest'

const contactsMigration = readFileSync('supabase/migrations/20260415000000_contacts_table.sql', 'utf-8')
const webhook = readFileSync('supabase/functions/whatsapp-webhook/index.ts', 'utf-8')
const contactsHook = readFileSync('src/hooks/useContactsData.ts', 'utf-8')
const contactsPage = readFileSync('src/components/dashboard/contacts/ContactsPage.tsx', 'utf-8')

describe('contacts runtime contract', () => {
  it('creates owner-scoped contacts and an atomic message recording RPC', () => {
    expect(contactsMigration).toContain('CREATE TABLE IF NOT EXISTS public.contacts')
    expect(contactsMigration).toContain('owner_id        uuid NOT NULL REFERENCES public.owners(id) ON DELETE CASCADE')
    expect(contactsMigration).toContain('CONSTRAINT contacts_owner_phone_unique UNIQUE (owner_id, phone)')
    expect(contactsMigration).toContain('CREATE INDEX IF NOT EXISTS idx_contacts_owner_last_active')
    expect(contactsMigration).toContain('CREATE OR REPLACE FUNCTION public.record_contact_message')
    expect(contactsMigration).toContain('ON CONFLICT (owner_id, phone)')
    expect(contactsMigration).toContain('total_messages = public.contacts.total_messages + 1')
  })

  it('protects contacts with owner and admin RLS policies', () => {
    expect(contactsMigration).toContain('ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY')
    expect(contactsMigration).toContain('CREATE POLICY "contacts_owner_all"')
    expect(contactsMigration).toContain('owner_id = (SELECT auth.uid())')
    expect(contactsMigration).toContain('CREATE POLICY "admin_select_all_contacts"')
    expect(contactsMigration).toContain('public.is_admin()')
  })

  it('awaits webhook persistence before returning the WhatsApp response', () => {
    expect(webhook).toContain("await logConversation(requestId, owner.id, customerPhone, 'inbound', rawText, 'bot')")
    expect(webhook).toContain('await recordContactMessage(requestId, owner.id, customerPhone)')
    expect(webhook).toContain('await receiveMessage(owner.id, customerPhone, rawText, message.id, owner.reception_phone, ownerCreds, requestId)')
    expect(webhook).not.toContain('.catch(err => console.error(`[${requestId}] receiveMessage error:`')
    expect(webhook).not.toContain('Fire-and-forget')
  })

  it('loads contacts by owner instead of the removed chatbot model', () => {
    expect(contactsHook).toContain(".eq('owner_id', ownerId)")
    expect(contactsHook).not.toContain(".eq('chatbot_id'")
    expect(contactsPage).toContain('useContactsData(ownerData?.id ?? null)')
    expect(contactsPage).not.toContain('useContactsData(null)')
  })
})
