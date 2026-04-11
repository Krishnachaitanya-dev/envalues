import { describe, it, expect } from 'vitest'
import { normalize } from '../../../supabase/functions/whatsapp-webhook/engine/normalize'

describe('normalize', () => {
  it('lowercases text', () => {
    expect(normalize('HELLO')).toBe('hello')
  })
  it('trims whitespace', () => {
    expect(normalize('  hi  ')).toBe('hi')
  })
  it('strips punctuation', () => {
    expect(normalize('hello!')).toBe('hello')
    expect(normalize("what's up?")).toBe('whats up')
  })
  it('collapses multiple spaces', () => {
    expect(normalize('ice   cream')).toBe('ice cream')
  })
  it('handles combined transformations', () => {
    expect(normalize('  Hello, World!  ')).toBe('hello world')
  })
  it('returns empty string for empty input', () => {
    expect(normalize('')).toBe('')
  })
})
