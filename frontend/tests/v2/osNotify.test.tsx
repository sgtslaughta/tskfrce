import { expect, test, jest } from '@jest/globals'
import { renderHook } from '@testing-library/react'
import { dest, useOsNotify } from '@/v2/osNotify'
import type { InboxItem } from '@/v2/hooks/useInbox'

const item = (id: number, extra: Partial<InboxItem> = {}): InboxItem => ({
  id, kind: 'chore_submitted', title: `n${id}`, body: null, created_at: '', read: false,
  run_id: null, redemption_id: null, device_id: null, thread_id: null, points: null, ...extra,
})

test('pops only items that arrive after load, in the background, with permission', () => {
  const made: string[] = []
  ;(window as unknown as { Notification: unknown }).Notification = Object.assign(
    function (this: { close: () => void }, title: string) { made.push(title); this.close = () => {} },
    { permission: 'granted' },
  )
  jest.spyOn(document, 'hasFocus').mockReturnValue(false)
  const { rerender } = renderHook(({ items }) => useOsNotify(items, () => {}), { initialProps: { items: [item(1)] } })
  expect(made).toEqual([]) // already there on load
  rerender({ items: [item(2), item(1)] })
  expect(made).toEqual(['n2'])
})

test('dest links devices, chores and reward requests', () => {
  expect(dest(item(1, { device_id: 6 }))).toBe('/devices?item=6')
  expect(dest(item(1, { run_id: 9 }))).toBe('/?chore=9')
  expect(dest(item(1, { kind: 'redemption_request', redemption_id: 3 }))).toBe('/?tab=needs')
  expect(dest(item(1, { kind: 'level_up' }))).toBeNull()
})

test('granting permission confirms with an OS notification', async () => {
  const { askOnFirstClick } = await import('@/v2/osNotify')
  const made: string[] = []
  ;(window as unknown as { Notification: unknown }).Notification = Object.assign(
    function (title: string) { made.push(title) },
    { permission: 'default', requestPermission: () => Promise.resolve('granted') },
  )
  askOnFirstClick()
  document.dispatchEvent(new Event('pointerdown'))
  await new Promise((r) => setTimeout(r, 0))
  expect(made).toEqual(['Notifications on'])
})
