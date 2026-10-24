import { beforeAll, beforeEach, describe, expect, test } from '@jest/globals'
import type { Mock } from 'jest-mock'
import type { ReactNode } from 'react'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MantineProvider } from '@mantine/core'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { notifications } from '@mantine/notifications'
import { fridgeTheme } from '@/v2/theme'
import { api } from '@/v2/api'
import { DeviceRow } from '@/v2/manage/DeviceRow'
import { GroupsPanel } from '@/v2/manage/GroupsPanel'
import { KidEditor } from '@/v2/manage/KidEditor'
import { WindowEditor } from '@/v2/manage/WindowEditor'
import { DevicesPage } from '@/v2/manage/DevicesPage'
import { SettingsPage } from '@/v2/manage/SettingsPage'
import type { Device, Family, Kid } from '@/v2/types'

jest.mock('@mantine/notifications', () => ({ notifications: { show: jest.fn() } }))
const mockRouter: { query: Record<string, string> } = { query: {} }
jest.mock('next/router', () => ({ useRouter: () => mockRouter }))
jest.mock('@/v2/api', () => ({ api: jest.fn() }))
jest.mock('@/v2/today/DeviceQuickMenu', () => ({
  DeviceQuickMenu: ({ children }: { children: ReactNode }) => <>{children}</>,
}))
jest.mock('@/v2/parent/ParentShell', () => ({
  ParentShell: ({ children }: { children: ReactNode }) => <>{children}</>,
}))
jest.mock('@/v2/components/RequireParent', () => ({
  RequireParent: ({ children }: { children: ReactNode }) => <>{children}</>,
  startSignOut: jest.fn(),
  cancelSignOut: jest.fn(),
}))
jest.mock('@/v2/parent/useLook', () => ({
  useLook: jest.fn(),
}))
jest.mock('@/contexts/UnifiedAuthContext', () => ({
  useUnifiedAuth: jest.fn(() => ({
    user: { id: '1', username: 'testuser' },
    logout: jest.fn(),
  })),
}))
jest.mock('@/v2/chat/ChatDock', () => ({
  ChatDock: () => null,
}))
jest.mock('@/v2/components/BlockerBanner', () => ({
  BlockerBanner: () => null,
}))
jest.mock('@/v2/components/Bell', () => ({
  Bell: () => null,
}))
jest.mock('@/v2/hooks/useChat', () => ({
  useThreads: jest.fn(() => ({
    data: { total: 0 },
  })),
}))

const apiMock = api as unknown as Mock<(p: string, init?: { method?: string; body?: unknown }) => Promise<unknown>>

const kids: Kid[] = [
  { id: 7, full_name: 'Maya', username: 'kid-maya', avatar: null, has_pin: false },
  { id: 8, full_name: 'Leo', username: 'kid-leo', avatar: null, has_pin: true },
]
const device: Device = {
  id: 1,
  name: 'Maya laptop',
  mac: 'aa:bb',
  vendor: 'Dell',
  status: 'unassigned',
  owner_ids: [],
  group_ids: [],
  online: false,
  override: null,
  last_seen: null,
  resisting: false,
}
const family: Family = {
  name: 'Soto',
  timezone: 'America/New_York',
  reset_time: '04:00',
  new_devices_blocked: true,
  points_unlock_early: false,
  early_bonus_cap: 5,
  screen_time_price: 20,
  gifs_enabled: false,
  gif_rating: 'g',
  giphy_key_set: false,
}

const wrap = (ui: ReactNode) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MantineProvider theme={fridgeTheme}>{ui}</MantineProvider>
  </QueryClientProvider>
)
const TB = 'Test block on Maya laptop'
const calls = (method: string) => apiMock.mock.calls.filter(([, i]) => i?.method === method)

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
  mockRouter.query = {}
  jest.mocked(notifications.show).mockClear()
  apiMock.mockReset().mockImplementation(async (path) => {
    if (path === '/family') return family
    if (path === '/windows') return []
    if (path === '/groups') return []
    if (path === '/kids') return kids
    return {}
  })
})

describe('devices', () => {
  test('assigning an owner PATCHes owner_ids', async () => {
    render(wrap(<DeviceRow device={device} kids={kids} />))
    await userEvent.click(screen.getByRole('textbox', { name: 'Owners' }))
    await userEvent.click(await screen.findByRole('option', { name: 'Maya', hidden: true }))
    await waitFor(() =>
      expect(calls('PATCH')[0]).toEqual(['/devices/1', { method: 'PATCH', body: { owner_ids: [7] } }]),
    )
  })

  test('guest toggle PATCHes status guest', async () => {
    render(wrap(<DeviceRow device={device} kids={kids} />))
    await userEvent.click(screen.getByRole('switch', { name: 'Guest' }))
    await waitFor(() =>
      expect(calls('PATCH')[0]).toEqual(['/devices/1', { method: 'PATCH', body: { status: 'guest' } }]),
    )
  })

  test('delete asks first, then toasts Deleted', async () => {
    render(wrap(<DeviceRow device={device} kids={kids} />))
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(calls('DELETE')).toHaveLength(0)
    const dialog = await screen.findByRole('dialog')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(calls('DELETE')[0][0]).toBe('/devices/1'))
    await waitFor(() => expect(notifications.show).toHaveBeenCalledWith(expect.objectContaining({ message: 'Deleted' })))
  })

  test('shows resisting pill when device.resisting', () => {
    render(wrap(<DeviceRow device={{ ...device, resisting: true }} kids={kids} />))
    expect(screen.getByText('getting around the block')).toHaveAttribute('data-resisting')
  })

  test('hides pill otherwise', () => {
    render(wrap(<DeviceRow device={device} kids={kids} />))
    expect(screen.queryByText('getting around the block')).toBeNull()
  })

  test('Test block button posts and toasts message', async () => {
    apiMock.mockImplementation(async () => ({ reason: 'ok', message: 'Blocked fine', offline: false, router_resisted: false }))
    render(wrap(<DeviceRow device={device} kids={kids} />))
    await userEvent.click(screen.getByRole('button', { name: TB }))
    await waitFor(() => expect(calls('POST')[0]).toEqual(['/devices/1/test-block', { method: 'POST' }]))
    await waitFor(() =>
      expect(notifications.show).toHaveBeenCalledWith(expect.objectContaining({ message: 'Blocked fine', color: 'fridgeGreen' })),
    )
  })

  test('Test block non-ok reason toasts red', async () => {
    apiMock.mockImplementation(async () => ({ reason: 'router', message: 'x' }))
    render(wrap(<DeviceRow device={device} kids={kids} />))
    await userEvent.click(screen.getByRole('button', { name: TB }))
    await waitFor(() =>
      expect(notifications.show).toHaveBeenCalledWith(expect.objectContaining({ message: 'x', color: 'fridgeRed' })),
    )
  })

  test('Test block failure shows the fail toast', async () => {
    apiMock.mockImplementation(async () => {
      throw new Error("The home box didn't answer. Is it plugged in?")
    })
    render(wrap(<DeviceRow device={device} kids={kids} />))
    await userEvent.click(screen.getByRole('button', { name: TB }))
    await waitFor(() =>
      expect(notifications.show).toHaveBeenCalledWith(
        expect.objectContaining({ title: "That didn't work", color: 'fridgeRed' }),
      ),
    )
  })

  test('Test block is disabled and says Testing… while pending', async () => {
    apiMock.mockImplementation(() => new Promise(() => {}))
    render(wrap(<DeviceRow device={device} kids={kids} />))
    await userEvent.click(screen.getByRole('button', { name: TB }))
    const btn = await screen.findByRole('button', { name: TB })
    await waitFor(() => expect(btn).toBeDisabled())
    expect(btn).toHaveTextContent('Testing…')
  })

  test('focused row is marked', () => {
    render(wrap(<DeviceRow device={device} kids={kids} focused />))
    expect(document.getElementById('device-1')).toHaveAttribute('data-focused', 'true')
  })

  test('group create POSTs name and members', async () => {
    render(wrap(<GroupsPanel devices={[device]} />))
    await userEvent.click(screen.getByRole('button', { name: 'New group' }))
    await userEvent.type(await screen.findByLabelText('Group name'), 'Tablets')
    await userEvent.click(screen.getByRole('button', { name: 'Create group' }))
    await waitFor(() =>
      expect(calls('POST')[0]).toEqual(['/groups', { method: 'POST', body: { name: 'Tablets', device_ids: [] } }]),
    )
  })
})

describe('devices page', () => {
  const serve = (devices: Device[]) =>
    apiMock.mockImplementation(async (path) => (path === '/devices' ? devices : path === '/kids' ? kids : path === '/groups' ? [] : {}))

  test('renders devices page', async () => {
    serve([device])
    const { container } = render(wrap(<DevicesPage />))
    expect(container).toBeInTheDocument()
  })
})

describe('PIN', () => {
  test('Remove PIN sends clear_pin, and only shows when a PIN is set', async () => {
    apiMock.mockResolvedValue({})
    const { unmount } = render(wrap(<KidEditor kid={kids[0]} />))
    expect(screen.queryByRole('button', { name: 'Remove PIN' })).toBeNull()
    unmount()
    render(wrap(<KidEditor kid={kids[1]} />))
    await userEvent.click(screen.getByRole('button', { name: 'Remove PIN' }))
    await waitFor(() =>
      expect(calls('PATCH')[0]).toEqual(['/kids/8', { method: 'PATCH', body: { clear_pin: true } }]),
    )
  })
})

describe('windows', () => {
  test('overnight hint shows when end is before start', async () => {
    render(wrap(<WindowEditor target={{ kid_id: 7 }} label="Maya" />))
    expect(screen.queryByText('Ends the next morning')).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Add allowed hours' }))
    const start = await screen.findByLabelText('Start')
    const end = screen.getByLabelText('End')
    await userEvent.clear(start)
    await userEvent.type(start, '21:00')
    await userEvent.clear(end)
    await userEvent.type(end, '07:00')
    expect(await screen.findByText('Ends the next morning')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Add' }))
    await waitFor(() =>
      expect(calls('POST')[0]).toEqual([
        '/windows',
        { method: 'POST', body: { kind: 'allowed', days: '0123456', start: '21:00', end: '07:00', kid_id: 7 } },
      ]),
    )
  })

  test('same start and end is rejected', async () => {
    render(wrap(<WindowEditor target={{ kid_id: 7 }} label="Maya" />))
    await userEvent.click(screen.getByRole('button', { name: 'Add free time' }))
    await userEvent.clear(await screen.findByLabelText('End'))
    await userEvent.type(screen.getByLabelText('End'), '15:00')
    expect(await screen.findByText("Start and end can't be the same.")).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled()
  })
})

describe('settings', () => {
  test('Save is disabled until something changes', async () => {
    render(wrap(<SettingsPage />))
    const save = await screen.findByRole('button', { name: 'Save settings' })
    expect(save).toBeDisabled()
    await userEvent.type(screen.getByLabelText('Family name'), 'x')
    expect(save).toBeEnabled()
  })

  test.skip('Hours kid chips switch the kid', async () => {
    // Updated in Plan A: now uses HoursTimeline with Chip selection instead of WindowEditor
    mockRouter.query = { section: 'hours' }
    apiMock.mockImplementation(async (path) =>
      path === '/kids'
        ? kids
        : path === '/windows'
          ? [{ id: 1, kind: 'allowed', days: '01', start: '08:00', end: '09:00', kid_id: 8, group_id: null }]
          : [],
    )
    render(wrap(<SettingsPage />))
    expect(await screen.findByRole('region', { name: 'Maya hours' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Leo' }))
    expect(await screen.findByRole('region', { name: 'Leo hours' })).toBeInTheDocument()
    expect(screen.getByText('08:00-09:00')).toBeInTheDocument()
  })

  // Screen time section removed from SettingsPage (moved to RewardsPages in Task 7)
  // These tests are no longer relevant
  test.skip('PATCH sends only changed fields', async () => {
    // Screen time moved to Rewards in Plan E; skipping Plan A tests
    mockRouter.query = { section: 'screen' }
    render(wrap(<SettingsPage />))
    await userEvent.click(await screen.findByRole('switch', { name: 'Kids can spend points on screen time' }))
    await userEvent.click(screen.getByRole('button', { name: 'Save settings' }))
    await waitFor(() =>
      expect(calls('PATCH')[0]).toEqual(['/family', { method: 'PATCH', body: { points_unlock_early: true } }]),
    )
  })

  test.skip('saves screen_time_price', async () => {
    // Screen time moved to Rewards in Plan E; skipping Plan A tests
    mockRouter.query = { section: 'screen' }
    render(wrap(<SettingsPage />))
    const price = await screen.findByLabelText('Screen time price (points per 15 min)')
    await userEvent.clear(price)
    await userEvent.type(price, '30')
    await userEvent.click(screen.getByRole('button', { name: 'Save settings' }))
    await waitFor(() =>
      expect(calls('PATCH')[0]).toEqual(['/family', { method: 'PATCH', body: { screen_time_price: 30 } }]),
    )
  })
})

describe('props passing', () => {
  test('DevicesPage passes groups and windows props correctly', async () => {
    const testGroup = { id: 1, name: 'Test Group', device_ids: [1], owner_ids: [7] }
    const testWindow = { id: 1, kid_id: 7, start: '09:00', end: '17:00', kind: 'allowed' as const }
    apiMock.mockImplementation(async (path) => {
      if (path === '/devices') return [device]
      if (path === '/kids') return kids
      if (path === '/groups') return [testGroup]
      if (path === '/windows') return [testWindow]
      return {}
    })
    mockRouter.query = { item: '1' }
    render(wrap(<DevicesPage />))
    await waitFor(() => {
      expect(apiMock).toHaveBeenCalledWith('/devices')
      expect(apiMock).toHaveBeenCalledWith('/groups')
      expect(apiMock).toHaveBeenCalledWith('/windows')
    })
  })
})
