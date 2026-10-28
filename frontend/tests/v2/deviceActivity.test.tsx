import { beforeAll, beforeEach, describe, expect, test } from '@jest/globals'
import type { Mock } from 'jest-mock'
import type { ReactNode } from 'react'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MantineProvider } from '@mantine/core'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fridgeTheme } from '@/v2/theme'
import { api } from '@/v2/api'
import { notifications } from '@mantine/notifications'
import { DeviceActivity } from '@/v2/manage/DeviceActivity'
import type { Device, DeviceActivity as Activity, DeviceEvent, Kid } from '@/v2/types'

jest.mock('next/router', () => ({ useRouter: () => ({ query: {}, push: jest.fn(), replace: jest.fn() }) }))
jest.mock('@mantine/notifications', () => ({ notifications: { show: jest.fn(), hide: jest.fn() } }))
jest.mock('@/v2/api', () => ({ api: jest.fn() }))

const apiMock = api as unknown as Mock<(p: string, o?: { method?: string; body?: unknown }) => Promise<unknown>>
const kids: Kid[] = [{ id: 7, full_name: 'Maya', username: 'kid-maya', avatar: null, has_pin: true }]
const device = {
  id: 1, name: 'Tablet', mac: 'aa:bb:cc:dd:ee:01', vendor: null, status: 'assigned', owner_ids: [7], group_ids: [],
  online: false, override: null, last_seen: null, resisting: false, exempt: false, reason: 'chores', chores_done: 0,
  chores_total: 0, locks_at: null, alerts: 2,
} as Device
const ev = (o: Partial<DeviceEvent>): DeviceEvent => ({
  id: 1, kind: 'bypass', at: '2026-10-26T20:00:00Z', last_at: null, count: 1, reason: null, kid_id: null,
  kid_name: null, by_name: null, other_device_id: null, other_device_name: null, minutes: null, detail: '',
  reviewed: false, ...o,
})
const days = ['2026-10-26', '2026-10-25', '2026-10-24', '2026-10-23', '2026-10-22', '2026-10-21', '2026-10-20'].map((date, i) => ({
  date, slots: '.'.repeat(144), online_minutes: i * 10,
}))
let data: Activity

const show = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MantineProvider theme={fridgeTheme}>
        <DeviceActivity device={device} kids={kids} timeZone="America/New_York" />
      </MantineProvider>
    </QueryClientProvider>,
  )
const feed = () => screen.findByRole('region', { name: 'Attempts & alerts' })

beforeAll(() => {
  window.matchMedia ??= ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} })) as never
})
beforeEach(() => {
  data = {
    counts: { bypass: 1, locked_tries: 3, outside_hours: 0, wrong_pins: 2 },
    events: [
      ev({ id: 11, kind: 'new_address', other_device_name: 'Mias-iPad', minutes: 2 }),
      ev({ id: 12, kind: 'locked_try', reason: 'chores', count: 3 }),
      ev({ id: 13, kind: 'sign_in', kid_id: 7, kid_name: 'Maya', count: 2 }),
    ],
    history: [ev({ id: 21, kind: 'unlocked', reason: 'manual', minutes: 30, by_name: 'Dad' })],
    days,
  }
  apiMock.mockReset().mockImplementation(async (path) => (path.endsWith('/activity') ? data : {}))
})

describe('device Activity', () => {
  test('KPI strip shows the 7-day counts, bypass in red when > 0', async () => {
    show()
    const kpi = await screen.findByText('Bypass attempts · 7d')
    expect(kpi.closest('.da-kpi')?.getAttribute('data-hi')).toBe('true')
    expect(screen.getByText('Wrong PINs · 7d').closest('.da-kpi')?.textContent).toContain('2')
  })

  test('filter Sign-in shows only the sign_in row', async () => {
    show()
    const f = await feed()
    await waitFor(() => expect(within(f).getAllByRole('listitem')).toHaveLength(3))
    await userEvent.click(within(f).getByRole('button', { name: 'Sign-in' }))
    const rows = within(f).getAllByRole('listitem')
    expect(rows).toHaveLength(1)
    expect(rows[0].textContent).toContain('wrong PIN')
  })

  test('Same device, merge posts the merge endpoint', async () => {
    show()
    await userEvent.click(await screen.findByRole('button', { name: /Same device, merge/ }))
    await waitFor(() => expect(apiMock).toHaveBeenCalledWith('/devices/1/events/11/merge', { method: 'POST' }))
  })

  test('a reviewed new address no longer offers merge buttons', async () => {
    data = { ...data, events: data.events.map((e) => (e.id === 11 ? { ...e, reviewed: true } : e)) }
    show()
    const f = await feed()
    await waitFor(() => expect(within(f).getAllByRole('listitem')).toHaveLength(3))
    expect(within(f).queryByRole('button', { name: /Same device, merge/ })).toBeNull()
    expect(within(f).queryByRole('button', { name: 'Different device' })).toBeNull()
  })

  test('Mark OK hides its button once reviewed', async () => {
    show()
    const f = await feed()
    await waitFor(() => expect(within(f).getAllByRole('button', { name: 'Mark OK' })).toHaveLength(2))
    data = { ...data, events: data.events.map((e) => (e.id === 12 ? { ...e, reviewed: true } : e)) }
    await userEvent.click(within(f).getAllByRole('button', { name: 'Mark OK' })[0])
    await waitFor(() => expect(apiMock).toHaveBeenCalledWith('/devices/1/events/12/ok', { method: 'POST' }))
    await waitFor(() => expect(within(f).getAllByRole('button', { name: 'Mark OK' })).toHaveLength(1))
  })

  test("Lock all posts the kid's override", async () => {
    show()
    await userEvent.click((await screen.findAllByRole('button', { name: "Lock all Maya's devices" }))[0])
    await waitFor(() =>
      expect(apiMock).toHaveBeenCalledWith('/kids/7/override', expect.objectContaining({ method: 'POST', body: expect.objectContaining({ action: 'lock' }) })),
    )
  })

  test('the Locked toast offers Undo, which puts the kid back on schedule', async () => {
    show()
    await userEvent.click((await screen.findAllByRole('button', { name: "Lock all Maya's devices" }))[0])
    await waitFor(() => expect(notifications.show).toHaveBeenCalled())
    const toast = render(<>{(notifications.show as Mock).mock.calls.at(-1)![0].message}</>)
    await userEvent.click(toast.getByRole('button', { name: 'Undo' }))
    await waitFor(() =>
      expect(apiMock).toHaveBeenCalledWith('/kids/7/override', expect.objectContaining({ method: 'DELETE' })),
    )
  })

  test('empty feed says no attempts this week', async () => {
    data = { ...data, events: [] }
    show()
    expect(await screen.findByText('No attempts this week')).toBeTruthy()
    expect(screen.getByText("Tablet hasn't tried to get around the lock or go online outside hours.")).toBeTruthy()
  })

  test('lock history row reads "Unlocked 30 min by Dad"', async () => {
    show()
    const h = await screen.findByRole('region', { name: 'Lock history' })
    expect(await within(h).findByText('Unlocked 30 min by Dad')).toBeTruthy()
  })

  test('time online has 7 bars, oldest first, Today last', async () => {
    show()
    const t = await screen.findByRole('region', { name: 'Time online per day' })
    await waitFor(() => expect(t.querySelectorAll('.da-bar')).toHaveLength(7))
    const bars = [...t.querySelectorAll('.da-bar')]
    expect(bars[0].getAttribute('title')).toBe('1 h')
    expect(bars[6].getAttribute('title')).toBe('0 min')
    expect(within(t).getAllByText(/./).at(-1)?.textContent).toBe('Today')
  })
})
