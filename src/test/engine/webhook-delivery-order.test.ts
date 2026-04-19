import { readFileSync } from 'fs'
import { describe, expect, it } from 'vitest'

const webhook = readFileSync('supabase/functions/whatsapp-webhook/index.ts', 'utf-8')

describe('webhook delivery order contract', () => {
  it('waits before sending choice UI after media so WhatsApp renders media first', () => {
    expect(webhook).toContain('CHOOSER_AFTER_MEDIA_DELAY_MS')
    expect(webhook).toContain('function isMediaMessage')
    expect(webhook).toContain('function isChoiceMessage')
    expect(webhook).toContain('previousWasMedia && isChoiceMessage(msg)')
    expect(webhook).toContain('await delay(CHOOSER_AFTER_MEDIA_DELAY_MS)')
    expect(webhook).toContain('previousWasMedia = isMediaMessage(msg)')
  })
})
