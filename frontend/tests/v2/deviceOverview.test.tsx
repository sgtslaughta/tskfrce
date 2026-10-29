import { beforeAll, beforeEach, describe, expect, test } from '@jest/globals'
import type { Mock } from 'jest-mock'
import type { ReactNode } from 'react'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MantineProvider } from '@mantine/core'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fridgeTheme } from '@/v2/theme'
import { api } from '@/v2/api'
import { DeviceDetail } from '@/v2/manage/DeviceDetail'
import type { Device, Kid } from '@/v2/types'

jest.mock('next/router', () => ({ useRouter: () => ({ query: {}, push: jest.fn(), replace: jest.fn() }) }))
jest.mock('@mantine/notifications', () => ({ notifications: { show: jest.fn() } }))
jest.mock('@/v2/api', () => ({ api: jest.fn() }))

const apiMock = api as unknown as Mock<(p: string, o?: { method?: string; body?: unknown }) => Promise<unknown>>
const kids: Kid[] = [{ id: 7, full_name: 'Maya', username: 'kid-maya', avatar: null, has_pin: true }]
const dev = (over: Partial<Device> = {}): Device => ({
  id: 1, name: 'Tablet', mac: 'aa:bb:cc:dd:ee:01', vendor: null, status: 'assigned', owner_ids: [7],
  group_ids: [], online: false, override: null, last_seen: null, resisting: false,
  exempt: false, reason: 'chores', chores_done: 3, chores_total: 5, locks_at: '2026-10-26T00:00:00Z', alerts: 1, address_changes: 1,
  ...over,
})
const day = (date: string) => ({ date, slots: 'o'.repeat(20) + 'l'.repeat(20) + '.'.repeat(104), online_minutes: 200 })
const days = ['2026-10-26', '2026-10-25', '2026-10-24', '2026-10-23', '2026-10-22', '2026-10-21', '2026-10-20'].map(day)
let blocker = { online: true }

const wrap = (ui: ReactNode) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MantineProvider theme={fridgeTheme}>{ui}</MantineProvider>
  </QueryClientProvider>
)
const show = (d: Device) => render(wrap(<DeviceDetail device={d} kids={kids} onRequestOverride={() => {}} />))

beforeAll(() => {
  window.matchMedia ??= ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} })) as never
  global.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
})
beforeEach(() => {
  blocker = { online: true }
  apiMock.mockReset().mockImplementation(async (path) => {
    if (path === '/family') return { timezone: 'America/New_York' }
    if (path === '/blocker') return blocker
    if (path.endsWith('/activity')) return { counts: {}, events: [], history: [], days }
    return {}
  })
})

describe('device Overview', () => {
  test('Right now explains a blocked device and when it locks', () => {
    show(dev())
    const right = screen.getByRole('region', { name: 'Right now' })
    expect(within(right).getByText('Locked')).toBeTruthy()
    expect(within(right).getByText('Chores 3/5 done')).toBeTruthy()
    expect(within(right).getByText('Locks at')).toBeTruthy()
    expect(within(right).getByText(/8:00\s?PM/)).toBeTruthy()
    expect(within(right).getByText('None · on schedule')).toBeTruthy()
  })

  test('an exempt device is Open, always allowed, with no lock time', () => {
    show(dev({ exempt: true, online: true, reason: 'exempt', locks_at: null }))
    const right = screen.getByRole('region', { name: 'Right now' })
    expect(within(right).getByText('Open')).toBeTruthy()
    expect(within(right).getByText('Always allowed')).toBeTruthy()
    expect(within(right).queryByText('Locks at')).toBeNull()
  })

  test('Online this week has 7 rows, Today first', async () => {
    show(dev())
    const week = await screen.findByRole('region', { name: 'Online this week' })
    await waitFor(() => expect(within(week).getAllByRole('listitem')).toHaveLength(7))
    expect(within(week).getAllByRole('listitem')[0].textContent).toMatch(/^Today/)
    expect(within(week).getByText('Sat')).toBeTruthy()
  })

  test('guest devices have no Online this week', () => {
    show(dev({ status: 'guest' }))
    expect(screen.queryByRole('region', { name: 'Online this week' })).toBeNull()
  })

  test('Always allowed switch saves exempt', async () => {
    show(dev())
    await userEvent.click(screen.getByRole('switch', { name: 'Always allowed (never lock)' }))
    expect(apiMock).toHaveBeenCalledWith('/devices/1', { method: 'PATCH', body: { exempt: true } })
  })

  test('Activity tab carries the alert count', () => {
    show(dev())
    const tab = screen.getByRole('tab', { name: /Activity/ })
    expect(tab.textContent).toContain('1')
  })
})

describe('device Network history rows', () => {
  const net = async (d: Device) => {
    show(d)
    await userEvent.click(screen.getByRole('tab', { name: 'Network' }))
    return screen.getByRole('region', { name: 'Connection' })
  }

  test('shows address changes and a healthy hold', async () => {
    const c = await net(dev())
    expect(within(c).getByText('Address changes (7 days)')).toBeTruthy()
    expect(within(c).getByText('Resisting blocker')).toBeTruthy()
    expect(await within(c).findByText('Healthy')).toBeTruthy()
  })

  test('slipping when resisting, box offline when the blocker is down', async () => {
    const c = await net(dev({ resisting: true }))
    expect(await within(c).findByText('Slipping')).toBeTruthy()
    expect(within(c).getByText('Yes')).toBeTruthy()
  })

  test('box offline', async () => {
    blocker = { online: false }
    const c = await net(dev())
    expect(await within(c).findByText('Box offline')).toBeTruthy()
  })
})
