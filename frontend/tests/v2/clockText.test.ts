import { expect, test } from '@jest/globals'
import { clockText, wallClock } from '@/v2/clockText'

test('clockText shows midnight for 12:00 AM only', () => {
  expect(clockText('2026-10-20T00:00:00Z', 'UTC')).toBe('midnight')
  expect(clockText('2026-10-20T04:00:00Z', 'America/New_York')).toBe('midnight')
  expect(clockText('2026-10-20T00:30:00Z', 'UTC')).toBe('12:30 AM')
  expect(clockText('2026-10-20T12:00:00Z', 'UTC')).toBe('12:00 PM')
  expect(clockText('2026-10-20T16:30:00Z', 'UTC')).toBe('4:30 PM')
  expect(clockText('2026-10-20T16:30:00Z', 'UTC', true)).toBe('4:30')
})

test('wallClock', () => {
  expect(wallClock('00:00')).toBe('midnight')
  expect(wallClock('24:00')).toBe('midnight')
  expect(wallClock('20:30')).toBe('8:30 PM')
  expect(wallClock('00:15')).toBe('12:15 AM')
})
