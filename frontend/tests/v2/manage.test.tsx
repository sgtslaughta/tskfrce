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
import { ChoreEditor } from '@/v2/manage/ChoreEditor'
import { ChoreList } from '@/v2/manage/ChoreList'
import { KidEditor } from '@/v2/manage/KidEditor'
import { WindowEditor } from '@/v2/manage/WindowEditor'
import { DevicesPage } from '@/v2/manage/DevicesPage'
import { SettingsPage } from '@/v2/manage/SettingsPage'
import type { Device, Family, Kid } from '@/v2/types'

jest.mock('@mantine/notifications', () => ({ notifications: { show: jest.fn() } }))
jest.mock('next/router', () => ({ useRouter: () => ({ query: {} }) }))
jest.mock('@/v2/api', () => ({ api: jest.fn() }))
jest.mock('@/v2/today/DeviceQuickMenu', () => ({
  DeviceQuickMenu: ({ children }: { children: ReactNode }) => <>{children}</>,
}))
jest.mock('@/v2/components/FridgeShell', () => ({
  FridgeShell: ({ children }: { children: ReactNode }) => <>{children}</>,
}))
jest.mock('@/v2/components/RequireParent', () => ({
  RequireParent: ({ children }: { children: ReactNode }) => <>{children}</>,
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
    await userEvent.type(screen.getByLabelText('New group name'), 'Tablets')
    await userEvent.click(screen.getByRole('button', { name: 'Create group' }))
    await waitFor(() =>
      expect(calls('POST')[0]).toEqual(['/groups', { method: 'POST', body: { name: 'Tablets', device_ids: [] } }]),
    )
  })
})

describe('devices page', () => {
  test('renders the honest promise note', async () => {
    apiMock.mockImplementation(async (path) => (path === '/devices' || path === '/kids' ? [] : {}))
    render(wrap(<DevicesPage />))
    expect(await screen.findByText(/The home box pauses internet/)).toBeInTheDocument()
  })
})

describe('chores', () => {
  test('Weekdays sends weekly Mon-Fri', async () => {
    render(wrap(<ChoreEditor kidId={7} />))
    await userEvent.type(screen.getByLabelText('Chore'), 'Feed the cat')
    await userEvent.selectOptions(screen.getByLabelText('Repeat'), 'Weekdays')
    await userEvent.click(screen.getByRole('button', { name: 'Add chore' }))
    await waitFor(() =>
      expect(calls('POST')[0]).toEqual([
        '/chores/',
        {
          method: 'POST',
          body: {
            title: 'Feed the cat',
            kid_id: 7,
            points: 10,
            repeat: { type: 'weekly', days: [0, 1, 2, 3, 4] },
            needs_photo: false,
          },
        },
      ]),
    )
  })
})

describe('repeating chores and PIN', () => {
  test('ChoreList offers Stop repeating for each definition', async () => {
    apiMock.mockImplementation(async (p) =>
      p.startsWith('/chores/definitions')
        ? [{ id: 5, title: 'Dishes', points: 10, kid_id: 7, repeat: { type: 'daily', days: [] }, needs_photo: false }]
        : {},
    )
    render(wrap(<ChoreList kidId={7} />))
    expect(apiMock).toHaveBeenCalledWith('/chores/definitions?kid_id=7')
    await userEvent.click(await screen.findByRole('button', { name: 'Stop repeating' }))
    await waitFor(() => expect(calls('DELETE')[0]).toEqual(['/chores/5', { method: 'DELETE' }]))
  })

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
    await userEvent.click(screen.getAllByRole('button', { name: 'Add allowed hours' })[0])
    const start = screen.getByLabelText('Start')
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
    await userEvent.click(screen.getAllByRole('button', { name: 'Add free time' })[0])
    await userEvent.clear(screen.getByLabelText('End'))
    await userEvent.type(screen.getByLabelText('End'), '15:00')
    expect(await screen.findByText("Start and end can't be the same.")).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled()
  })
})

describe('settings', () => {
  test('PATCH sends only changed fields', async () => {
    render(wrap(<SettingsPage />))
    await userEvent.click(await screen.findByRole('switch', { name: 'Points can unlock early' }))
    await userEvent.click(screen.getByRole('button', { name: 'Save settings' }))
    await waitFor(() =>
      expect(calls('PATCH')[0]).toEqual(['/family', { method: 'PATCH', body: { points_unlock_early: true } }]),
    )
  })
})
