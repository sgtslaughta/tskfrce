import { beforeEach, describe, expect, test } from '@jest/globals'
import type { Mock } from 'jest-mock'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MantineProvider } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { api } from '@/v2/api'
import { NotificationsPane } from '@/v2/manage/NotificationsPane'
import { SettingsPage } from '@/v2/manage/SettingsPage'

jest.mock('@/v2/api', () => ({ api: jest.fn() }))
jest.mock('@mantine/notifications', () => ({ notifications: { show: jest.fn() } }))
jest.mock('next/router', () => ({ useRouter: () => ({ query: { section: 'notifications' }, push: jest.fn() }) }))
jest.mock('@/v2/components/RequireParent', () => ({ RequireParent: ({ children }: { children: unknown }) => children }))
jest.mock('@/v2/parent/ParentShell', () => ({
  ParentShell: ({ children, list }: { children: React.ReactNode; list: React.ReactNode }) => (
    <div>
      {list}
      {children}
    </div>
  ),
}))

type Init = { method?: string; body?: unknown }
const apiMock = api as unknown as Mock<(p: string, i?: Init) => Promise<unknown>>
const showMock = notifications.show as unknown as Mock<(o: { message: unknown }) => void>

const RAW = 'signal://+15551234567/group.abcdef'
const place = {
  id: 1,
  name: "Parents' Signal group",
  url_mask: 'signal://+1555••••••/group.••••••••',
  enabled: true,
  events: ['chore_ok'],
  readable: true,
}
const settings = {
  quiet_start: null,
  quiet_end: null,
  quiet_security: true,
  app_address: null,
  app_address_default: null,
  events: [
    { key: 'chore_ok', label: 'Chore needs OK', security: false },
    { key: 'kid_note', label: 'Kid note', security: false },
  ],
}

const serve = (places: object[], test: object = { ok: true, error: null }) =>
  apiMock.mockImplementation(async (p, i) => {
    if (p === '/notify/places' && !i?.method) return places
    if (p === '/notify/settings' && !i?.method) return settings
    if (p.endsWith('/test')) return test
    if (p === '/family') return { name: 'Fam' }
    return {}
  })

const wrap = (ui: React.ReactElement) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MantineProvider>{ui}</MantineProvider>
    </QueryClientProvider>,
  )
const calls = (p: string, method: string) => apiMock.mock.calls.filter((c) => c[0] === p && c[1]?.method === method)

beforeEach(() => {
  apiMock.mockReset()
  showMock.mockReset()
  window.matchMedia =
    window.matchMedia ||
    ((() => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} })) as never)
})

describe('NotificationsPane', () => {
  test("shows a place's name and mask, never a raw URL", async () => {
    serve([place])
    wrap(<NotificationsPane />)
    expect(await screen.findByText("Parents' Signal group")).toBeTruthy()
    expect(screen.getByText(place.url_mask)).toBeTruthy()
    expect(document.body.textContent).not.toContain(RAW)
  })

  test('clicking a chip patches the place events', async () => {
    serve([place])
    wrap(<NotificationsPane />)
    await userEvent.click(await screen.findByRole('button', { name: 'Kid note' }))
    await waitFor(() => expect(calls('/notify/places/1', 'PATCH')).toHaveLength(1))
    const body = calls('/notify/places/1', 'PATCH')[0][1]?.body as { events: string[] }
    expect(body.events).toEqual(expect.arrayContaining(['chore_ok', 'kid_note']))
  })

  test('a failed test shows the error text', async () => {
    serve([place], { ok: false, error: '401 Unauthorized' })
    wrap(<NotificationsPane />)
    await userEvent.click(await screen.findByRole('button', { name: 'Test' }))
    await waitFor(() => expect(showMock).toHaveBeenCalled())
    expect(showMock.mock.calls[0][0].message).toBe('401 Unauthorized')
  })

  test('empty list shows the empty state', async () => {
    serve([])
    wrap(<NotificationsPane />)
    expect(await screen.findByText('No places yet')).toBeTruthy()
  })

  test('add a place posts name and url', async () => {
    serve([])
    wrap(<NotificationsPane />)
    await userEvent.click(await screen.findByRole('button', { name: 'Add a place' }))
    await userEvent.type(await screen.findByLabelText('Name'), 'Family Discord')
    await userEvent.type(screen.getByLabelText('Apprise address'), 'json://127.0.0.1:9/nowhere')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(calls('/notify/places', 'POST')).toHaveLength(1))
    expect(calls('/notify/places', 'POST')[0][1]?.body).toEqual({ name: 'Family Discord', url: 'json://127.0.0.1:9/nowhere' })
  })
})

describe('Settings list', () => {
  test('has a Notifications link', async () => {
    serve([])
    wrap(<SettingsPage />)
    const link = await screen.findByRole('link', { name: /Notifications/ })
    expect(link.getAttribute('href')).toBe('/settings?section=notifications')
  })
})
