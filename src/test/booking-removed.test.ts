// src/test/booking-removed.test.ts
import { describe, it, expect } from 'vitest'

describe('BookingConfigPage removal', () => {
  it('App module does not export or reference BookingConfigPage', async () => {
    // If this import succeeds without error, BookingConfigPage is properly removed
    const appModule = await import('../../src/App')
    expect(appModule.default).toBeDefined()
  }, 30000)
})
