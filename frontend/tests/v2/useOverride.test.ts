import { describe, expect, test } from '@jest/globals'
import { undoChoice } from '@/v2/hooks/useOverride'

describe('undoChoice', () => {
  const now = Date.parse('2026-01-01T10:00:00Z')
  test('no previous override goes back to the schedule', () => {
    expect(undoChoice(null, now)).toEqual({ action: 'clear' })
    expect(undoChoice(undefined, now)).toEqual({ action: 'clear' })
  })
  test('a previous timed override is restored with its minutes left', () => {
    expect(undoChoice({ action: 'unlock', expires_at: '2026-01-01T10:20:30Z' }, now)).toEqual({ action: 'unlock', minutes: 21 })
  })
  test('a previous open-ended override stays open-ended', () => {
    expect(undoChoice({ action: 'lock', expires_at: null }, now)).toEqual({ action: 'lock', minutes: null })
  })
  test('a previous override that already expired goes back to the schedule', () => {
    expect(undoChoice({ action: 'unlock', expires_at: '2026-01-01T09:59:00Z' }, now)).toEqual({ action: 'clear' })
  })
})
