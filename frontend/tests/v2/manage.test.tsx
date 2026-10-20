import { beforeAll, beforeEach, describe, expect, test } from '@jest/globals'
import type { Mock } from 'jest-mock'
import type { ReactNode } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MantineProvider } from '@mantine/core'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fridgeTheme } from '@/v2/theme'
import { api } from '@/v2/api'
import { DeviceRow } from '@/v2/manage/DeviceRow'
import { GroupsPanel } from '@/v2/manage/GroupsPanel'
import { ChoreEditor } from '@/v2/manage/ChoreEditor'
import { WindowEditor } from '@/v2/manage/WindowEditor'
import { SettingsPage } from '@/v2/manage/SettingsPage'
import type { Device, Family, Kid } from '@/v2/types'

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

  test('group create POSTs name and members', async () => {
    render(wrap(<GroupsPanel devices={[device]} />))
    await userEvent.type(screen.getByLabelText('New group name'), 'Tablets')
    await userEvent.click(screen.getByRole('button', { name: 'Create group' }))
    await waitFor(() =>
      expect(calls('POST')[0]).toEqual(['/groups', { method: 'POST', body: { name: 'Tablets', device_ids: [] } }]),
    )
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
