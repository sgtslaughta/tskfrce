import { describe, expect, test } from '@jest/globals'
import { deviceSubline } from '@/v2/manage/deviceMeta'

const base = { status: 'assigned', vendor: null, first_seen: null, last_seen: null }

describe('deviceSubline', () => {
  test('assigned shows owner and last seen', () => {
    expect(deviceSubline({ ...base, last_seen: new Date().toISOString() }, 'Bobby')).toBe('Bobby · just now')
    expect(deviceSubline(base, 'Bobby')).toBe('Bobby · never seen')
  })
  test('guest says it is never blocked', () => {
    expect(deviceSubline({ ...base, status: 'guest' }, '—')).toBe('Guest · never blocked')
  })
  test('new device shows vendor and join time, never a dash', () => {
    const d = { ...base, status: 'unassigned', vendor: 'Samsung', first_seen: new Date().toISOString() }
    expect(deviceSubline(d, '—')).toBe('Samsung · joined just now')
    expect(deviceSubline({ ...base, status: 'unassigned' }, '—')).toBe('New device')
  })
})
