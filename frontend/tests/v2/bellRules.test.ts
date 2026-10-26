import { describe, expect, test } from '@jest/globals'
import { isAlert, isNeedsYou, severity, when } from '@/v2/components/bellRules'
import type { InboxItem } from '@/v2/hooks/useInbox'

const n = (over: Partial<InboxItem>): InboxItem => ({
  id: 1, kind: 'chore_submitted', title: 'x', body: null, created_at: new Date().toISOString(), read: false,
  run_id: null, redemption_id: null, device_id: null, thread_id: null, points: null,
  kid_id: null, kid_name: null, glyph: null, pending: false, ...over,
})

describe('bellRules', () => {
  test('isNeedsYou follows the server pending flag', () => {
    expect(isNeedsYou(n({ kind: 'chore_note', pending: true }))).toBe(true)
    expect(isNeedsYou(n({ kind: 'chore_note', pending: false, read: true }))).toBe(false)
    expect(isNeedsYou(n({ kind: 'new_device', pending: true }))).toBe(false)
  })

  test('isAlert covers resisting, bypass and box offline only', () => {
    expect(isAlert(n({ kind: 'new_device' }))).toBe(false)
    expect(isAlert(n({ kind: 'device_bypass' }))).toBe(true)
    expect(isAlert(n({ kind: 'box_offline' }))).toBe(true)
  })

  test('severity uses the chore glyph', () => {
    expect(severity(n({ kind: 'chore_submitted', glyph: 'school' }))).toEqual({ name: 'school', tone: 'lv' })
    expect(severity(n({ kind: 'chore_note' }))).toEqual({ name: 'flag', tone: 'md' })
    expect(severity(n({ kind: 'box_offline' }))).toEqual({ name: 'router', tone: 'hi' })
  })

  test('when says Yesterday for 24 h ago', () => {
    const now = new Date(2026, 9, 26, 12, 0)
    expect(when(new Date(2026, 9, 25, 12, 0).toISOString(), now)).toBe('Yesterday')
  })
})
