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

  test('a double click on an owner pill or Test block sends exactly one request', async () => {
    apiMock.mockImplementation(() => new Promise(() => {})) // the first request is still in flight for the second click
    render(wrap(<DeviceDetail device={dev({ owner_ids: [] })} kids={kids} onRequestOverride={() => {}} />))
    await userEvent.dblClick(screen.getByRole('button', { name: 'Maya' }))
    await userEvent.dblClick(screen.getByRole('button', { name: /Test block/ }))
    const calls = (path: string) => apiMock.mock.calls.filter(([p]) => p === path)
    expect(calls('/devices/1')).toHaveLength(1)
    expect(apiMock).toHaveBeenCalledWith('/devices/1', { method: 'PATCH', body: { owner_ids: [7] } })
    expect(calls('/devices/1/test-block')).toHaveLength(1)
  })

  test('names stop at the 100 characters the API accepts', () => {
    render(wrap(<DeviceDetail device={dev()} kids={kids} onRequestOverride={() => {}} />))
    expect(screen.getByLabelText('Device name').getAttribute('maxlength')).toBe('100')
  })
})

describe('DeviceList status glyph', () => {
  const list = (devices: Device[]) => render(wrap(<DeviceList devices={devices} kids={kids} onSelectDevice={() => {}} />))

  const glyph = (row: RegExp) => within(screen.getByRole('button', { name: row })).getByRole('img').getAttribute('aria-label')

  test('a lock you pressed shows Locked, an expired one shows the real internet state again', () => {
    const future = new Date(Date.now() + 600000).toISOString()
    const past = new Date(Date.now() - 600000).toISOString()
    list([dev({ id: 1, name: 'Locked one', online: true, override: { action: 'lock', expires_at: future } }), dev({ id: 2, name: 'Was locked', online: true, override: { action: 'lock', expires_at: past } })])
    expect(glyph(/Locked one/)).toBe('Locked by you')
    expect(glyph(/Was locked/)).toBe('Internet on')
  })

  test('a kid device cut off by hours or chores shows Internet off, not Open', () => {
    list([dev({ id: 1, name: 'Blocked', online: false })])
    expect(glyph(/Blocked/)).toBe('Internet off · hours or chores')
  })

  test("unknown devices say Who's this? and sort first", () => {
    list([dev({ id: 1, name: 'Known' }), dev({ id: 2, name: 'Mystery', status: 'unassigned', owner_ids: [] })])
    const names = screen.getAllByRole('button').filter((b) => b.hasAttribute('data-device')).map((b) => b.getAttribute('data-device'))
    expect(names).toEqual(['2', '1'])
    expect(glyph(/Mystery/)).toMatch(/^Who's this\?/)
  })
})

describe('GroupDetail with no devices', () => {
  const empty: Group = { id: 3, name: 'Empty group', device_ids: [], icon: 'devices', chore_lock: true }

  test('says so, hides the open/locked chips and disables lock, unlock and back-to-schedule', () => {
    render(wrap(<GroupDetail group={empty} devices={[dev()]} kids={kids} groups={[empty]} rules={[]} onSelect={() => {}} onRequestOverride={() => {}} />))
    expect(screen.getByText('No devices in this group yet. Tap a device to add it.')).toBeTruthy()
    expect(screen.getByText('0 devices')).toBeTruthy()
    expect(screen.queryByText('0 open')).toBeNull()
    for (const name of ['Lock group', 'Unlock 30 min', 'Back to schedule']) expect((screen.getByRole('button', { name }) as HTMLButtonElement).disabled).toBe(true)
  })

  test('Create group on a new group sends one POST even when mashed', async () => {
    apiMock.mockImplementation(() => new Promise(() => {}))
    render(wrap(<GroupDetail devices={[dev({ name: 'Switch' })]} kids={kids} groups={[]} rules={[]} onSelect={() => {}} onRequestOverride={() => {}} />))
    await userEvent.type(screen.getByLabelText('Group name'), 'Twins')
    await userEvent.click(screen.getByRole('button', { name: 'Switch' }))
    await userEvent.dblClick(screen.getByRole('button', { name: 'Create group' }))
    const posts = apiMock.mock.calls.filter(([p, o]) => p === '/groups' && o?.method === 'POST')
    expect(posts).toHaveLength(1)
    expect(posts[0][1]).toEqual({ method: 'POST', body: { name: 'Twins', device_ids: [1] } })
  })

  test('tapping a device saves the group with exactly that member', async () => {
    render(wrap(<GroupDetail group={empty} devices={[dev({ name: 'Switch' })]} kids={kids} groups={[empty]} rules={[]} onSelect={() => {}} onRequestOverride={() => {}} />))
    await userEvent.click(screen.getByRole('button', { name: 'Switch' }))
    expect(apiMock).toHaveBeenCalledWith('/groups/3', { method: 'PATCH', body: { name: 'Empty group', device_ids: [1] } })
  })
})

describe('GroupDetail icon, chore switch, hours and summary', () => {
  const g: Group = { id: 3, name: 'Consoles', device_ids: [1, 2, 4], icon: 'devices', chore_lock: true }
  const rule = (id: number, name: string, over: Record<string, unknown> = {}) =>
    ({ id, name, category: 'other', kind: 'allowed', days: '0123456', start_date: null, end_date: null, everyone: false, kid_ids: [], group_ids: [], times: [{ start: '08:00', end: '20:00' }], ...over }) as never
  const members = [
    dev({ id: 1, name: 'Switch', alerts: 1, locks_at: '2026-10-26T23:30:00Z' }),
    dev({ id: 2, name: 'Xbox', alerts: 2, override: { action: 'unlock', expires_at: null } as never }),
    dev({ id: 4, name: 'PS5', override: { action: 'lock', expires_at: null } as never, locks_at: '2026-10-27T03:00:00Z' }),
  ]
  const show = (rules: never[] = []) =>
    render(wrap(<GroupDetail group={g} devices={members} kids={kids} groups={[g]} rules={rules} timeZone="America/New_York" onSelect={() => {}} onRequestOverride={() => {}} />))

  test('picking tv saves icon tv', async () => {
    show()
    await userEvent.click(screen.getByTitle('tv'))
    expect(apiMock).toHaveBeenCalledWith('/groups/3', { method: 'PATCH', body: expect.objectContaining({ icon: 'tv', chore_lock: true }) })
  })

  test('switching off the chore lock saves chore_lock false', async () => {
    show()
    await userEvent.click(screen.getByRole('switch', { name: /Lock with the kids/ }))
    expect(apiMock).toHaveBeenCalledWith('/groups/3', { method: 'PATCH', body: expect.objectContaining({ chore_lock: false }) })
    expect(screen.getByText(/these devices skip the chore check/)).toBeTruthy()
  })

  test('hours card lists everyone and this group rules, not another group', () => {
    show([rule(1, 'Family hours', { everyone: true }), rule(2, 'Tablets only', { group_ids: [3] }), rule(3, 'Other group rule', { group_ids: [9] })] as never)
    const card = within(screen.getByRole('region', { name: 'Hours' }))
    expect(card.getByText('Family hours')).toBeTruthy()
    expect(card.getByText('Tablets only')).toBeTruthy()
    expect(card.queryByText('Other group rule')).toBeNull()
    expect(card.getByText(/only this group/)).toBeTruthy()
    expect(card.getByRole('link', { name: /Edit in Settings/ }).getAttribute('href')).toBe('/settings?section=hours')
  })

  test('summary strip shows open count, alerts, overrides and next lock in family time', () => {
    show()
    const strip = within(screen.getByRole('group', { name: 'Group summary' }))
    expect(strip.getByText('2 of 3')).toBeTruthy()
    expect(strip.getByText('3')).toBeTruthy()
    expect(strip.getByText('Overrides today').nextSibling?.textContent).toBe('2')
    expect(strip.getByText('Next lock').nextSibling?.textContent).toMatch(/7:30\s?PM/)
  })
})
