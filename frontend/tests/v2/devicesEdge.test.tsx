import { afterEach, beforeAll, beforeEach, describe, expect, test } from '@jest/globals'
import type { Mock } from 'jest-mock'
import type { ReactNode } from 'react'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MantineProvider } from '@mantine/core'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fridgeTheme } from '@/v2/theme'
import { api } from '@/v2/api'
import { DeviceDetail } from '@/v2/manage/DeviceDetail'
import { DeviceList } from '@/v2/manage/DeviceList'
import { GroupDetail } from '@/v2/manage/GroupDetail'
import { ago, inFamilyZone } from '@/v2/manage/deviceMeta'
import type { Device, Group, Kid } from '@/v2/types'

jest.mock('next/router', () => ({ useRouter: () => ({ query: {}, push: jest.fn(), replace: jest.fn() }) }))
jest.mock('@mantine/notifications', () => ({ notifications: { show: jest.fn() } }))
jest.mock('@/v2/api', () => ({ api: jest.fn() }))

const apiMock = api as unknown as Mock<(p: string, o?: { method?: string; body?: unknown }) => Promise<unknown>>
const kids: Kid[] = [{ id: 7, full_name: 'Maya', username: 'kid-maya', avatar: null, has_pin: true }]
const dev = (over: Partial<Device> = {}): Device => ({
  id: 1, name: 'Tablet', mac: 'aa:bb:cc:dd:ee:01', vendor: null, status: 'assigned', owner_ids: [7],
  group_ids: [], online: false, override: null, last_seen: null, resisting: false, ...over,
})
const wrap = (ui: ReactNode) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MantineProvider theme={fridgeTheme}>{ui}</MantineProvider>
  </QueryClientProvider>
)

beforeAll(() => {
  window.matchMedia ??= ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} })) as never
  global.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  Element.prototype.scrollIntoView = jest.fn()
})
beforeEach(() => {
  apiMock.mockReset().mockImplementation(async (path) => (path === '/family' ? { timezone: 'Pacific/Auckland' } : {}))
})
afterEach(() => jest.useRealTimers())

describe('device time helpers', () => {
  test('ago never goes negative or says 0m', () => {
    expect(ago(new Date(Date.now() + 5 * 60000).toISOString())).toBe('just now')
    expect(ago(new Date(Date.now() - 20000).toISOString())).toBe('just now')
    expect(ago(new Date(Date.now() - 5 * 60000).toISOString())).toBe('5m ago')
    expect(ago(new Date(Date.now() - 3 * 3600000).toISOString())).toBe('3h ago')
    expect(ago(null)).toBe('never')
  })

  test('inFamilyZone shows the family clock, not the browser clock', () => {
    const iso = '2026-10-25T00:00:00Z'
    expect(inFamilyZone(iso, 'Pacific/Auckland')).toMatch(/Oct 25, 2026.*1:00\s?PM/)
    expect(inFamilyZone(iso, 'UTC')).toMatch(/Oct 25, 2026.*12:00\s?AM/)
    expect(inFamilyZone(iso, 'Not/AZone')).toMatch(/2026/)
  })
})

describe('DeviceDetail', () => {
  test('an unlock that expires while the screen is open goes back to "None, on schedule"', async () => {
    jest.useFakeTimers({ now: new Date('2026-10-25T10:00:00Z') })
    const d = dev({ override: { action: 'unlock', expires_at: '2026-10-25T10:00:02Z' } })
    render(wrap(<DeviceDetail device={d} kids={kids} onRequestOverride={() => {}} />))
    const right = screen.getByRole('region', { name: 'Right now' })
    expect(within(right).getByText('Unlocked')).toBeTruthy()
    expect(within(right).getByText('Expires at')).toBeTruthy()
    await act(async () => {
      jest.advanceTimersByTime(3000)
    })
    expect(within(right).getByText('None, on schedule')).toBeTruthy()
    expect(within(right).queryByText('Expires at')).toBeNull()
  })

  test('Expires at is in the family time zone', async () => {
    const d = dev({ override: { action: 'lock', expires_at: new Date(Date.now() + 3600000).toISOString() } })
    render(wrap(<DeviceDetail device={d} kids={kids} onRequestOverride={() => {}} />))
    await waitFor(() => expect(apiMock).toHaveBeenCalledWith('/family'))
    const want = inFamilyZone(d.override!.expires_at!, 'Pacific/Auckland')
    expect(await screen.findByText(want)).toBeTruthy()
  })

  test('a double click on Delete in the dialog sends exactly one DELETE', async () => {
    render(wrap(<DeviceDetail device={dev()} kids={kids} onRequestOverride={() => {}} />))
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
    const dialog = await screen.findByRole('dialog')
    await userEvent.dblClick(within(dialog).getByRole('button', { name: 'Delete' }))
    const deletes = apiMock.mock.calls.filter(([p, o]) => p === '/devices/1' && o?.method === 'DELETE')
    expect(deletes).toHaveLength(1)
  })

  test('names stop at the 100 characters the API accepts', () => {
    render(wrap(<DeviceDetail device={dev()} kids={kids} onRequestOverride={() => {}} />))
    expect(screen.getByLabelText('Device name').getAttribute('maxlength')).toBe('100')
  })
})

describe('DeviceList status chip', () => {
  const list = (devices: Device[]) => render(wrap(<DeviceList devices={devices} kids={kids} onSelectDevice={() => {}} />))

  test('a lock you pressed shows Locked, an expired one shows Open again', () => {
    const future = new Date(Date.now() + 600000).toISOString()
    const past = new Date(Date.now() - 600000).toISOString()
    list([dev({ id: 1, name: 'Locked one', override: { action: 'lock', expires_at: future } }), dev({ id: 2, name: 'Was locked', override: { action: 'lock', expires_at: past } })])
    expect(within(screen.getByRole('button', { name: /Locked one/ })).getByText('Locked')).toBeTruthy()
    expect(within(screen.getByRole('button', { name: /Was locked/ })).getByText('Open')).toBeTruthy()
  })

  test("unknown devices say Who's this? and sort first", () => {
    list([dev({ id: 1, name: 'Known' }), dev({ id: 2, name: 'Mystery', status: 'unassigned', owner_ids: [] })])
    const names = screen.getAllByRole('button').filter((b) => b.hasAttribute('data-device')).map((b) => b.getAttribute('data-device'))
    expect(names).toEqual(['2', '1'])
    expect(within(screen.getByRole('button', { name: /Mystery/ })).getByText("Who's this?")).toBeTruthy()
  })
})

describe('GroupDetail with no devices', () => {
  const empty: Group = { id: 3, name: 'Empty group', device_ids: [] }

  test('says so, hides the open/locked chips and disables lock, unlock and back-to-schedule', () => {
    render(wrap(<GroupDetail group={empty} devices={[dev()]} kids={kids} groups={[empty]} windows={[]} onSelect={() => {}} onRequestOverride={() => {}} />))
    expect(screen.getByText('No devices in this group yet. Tap a device to add it.')).toBeTruthy()
    expect(screen.getByText('0 devices')).toBeTruthy()
    expect(screen.queryByText('0 open')).toBeNull()
    for (const name of ['Lock group', 'Unlock 30 min', 'Back to schedule']) expect((screen.getByRole('button', { name }) as HTMLButtonElement).disabled).toBe(true)
  })

  test('tapping a device saves the group with exactly that member', async () => {
    render(wrap(<GroupDetail group={empty} devices={[dev({ name: 'Switch' })]} kids={kids} groups={[empty]} windows={[]} onSelect={() => {}} onRequestOverride={() => {}} />))
    await userEvent.click(screen.getByRole('button', { name: 'Switch' }))
    expect(apiMock).toHaveBeenCalledWith('/groups/3', { method: 'PATCH', body: { name: 'Empty group', device_ids: [1] } })
  })
})
