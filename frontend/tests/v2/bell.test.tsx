import { beforeEach, describe, expect, test } from '@jest/globals'
import type { Mock } from 'jest-mock'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MantineProvider } from '@mantine/core'
import { api } from '@/v2/api'
import { Bell } from '@/v2/components/Bell'
import { openChat } from '@/v2/chat/dock'

const push = jest.fn()
jest.mock('@/v2/api', () => ({ api: jest.fn() }))
jest.mock('@mantine/notifications', () => ({ notifications: { show: jest.fn() } }))
jest.mock('next/router', () => ({ useRouter: () => ({ push }) }))
jest.mock('@/v2/chat/dock', () => ({ openChat: jest.fn() }))

const apiMock = api as unknown as Mock<(p: string, i?: { method?: string; kid?: boolean }) => Promise<unknown>>
const item = (id: number, over: object = {}) => ({
  id, kind: 'chore_submitted', title: `Item ${id}`, body: null, created_at: new Date().toISOString(),
  read: false, run_id: null, redemption_id: null, device_id: null, thread_id: null, points: null,
  kid_id: null, kid_name: null, glyph: null, pending: false, ...over,
})
const serve = (items: object[], unread = items.length) =>
  apiMock.mockImplementation(async (p) => (p === '/notifications' ? { items, unread, has_more: false } : undefined))
const wrap = (ui: React.ReactElement) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MantineProvider>{ui}</MantineProvider>
    </QueryClientProvider>,
  )
const posts = (p: string) => apiMock.mock.calls.filter((c) => c[0] === p && c[1]?.method === 'POST')

beforeEach(() => {
  apiMock.mockReset()
  push.mockReset()
  ;(openChat as unknown as Mock).mockReset()
  window.matchMedia =
    window.matchMedia ||
    ((() => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} })) as never)
})

describe('Bell', () => {
  test('count hidden at 0 and 9+ over 9', async () => {
    serve([], 0)
    const { unmount } = wrap(<Bell />)
    await waitFor(() => expect(apiMock).toHaveBeenCalled())
    expect(screen.getByRole('button', { name: 'Notifications' })).toBeTruthy()
    unmount()
    serve([item(1)], 12)
    wrap(<Bell />)
    expect(await screen.findByText('9+')).toBeTruthy()
  })

  test('lists items in order', async () => {
    serve([
      item(3, { run_id: 7, kind: 'chore_submitted' }),
      item(2, { device_id: 5, kind: 'new_device' }),
      item(1, { redemption_id: 4, kind: 'redemption_request', read: true }),
    ])
    wrap(<Bell />)
    await userEvent.click(await screen.findByRole('button', { name: /Notifications/ }))
    const titles = (await screen.findAllByText(/^Item \d$/)).map((e) => e.textContent)
    expect(titles).toEqual(['Item 3', 'Item 2', 'Item 1'])
  })

  test('mark all read', async () => {
    serve([item(1), item(2)])
    wrap(<Bell />)
    await userEvent.click(await screen.findByRole('button', { name: /Notifications/ }))
    await userEvent.click(await screen.findByRole('button', { name: 'Mark all read' }))
    expect(posts('/notifications/read-all')).toHaveLength(1)
  })

  test('kid bell uses the kid token and does not navigate', async () => {
    serve([item(1, { run_id: 7 })])
    wrap(<Bell kid />)
    await userEvent.click(await screen.findByRole('button', { name: /Notifications/ }))
    await userEvent.click(await screen.findByText('Item 1'))
    expect(apiMock.mock.calls.every((c) => c[1]?.kid === true)).toBe(true)
    expect(push).not.toHaveBeenCalled()
  })

  test('filters count by kind', async () => {
    serve(
      [
        item(1, { kind: 'chore_submitted', run_id: 1, pending: true }),
        item(2, { kind: 'chore_submitted', run_id: 2, pending: true }),
        item(3, { kind: 'redemption_request', redemption_id: 3, pending: true }),
        item(4, { kind: 'new_device' }),
        item(5, { kind: 'device_resisting' }),
      ],
      5,
    )
    wrap(<Bell />)
    await userEvent.click(await screen.findByRole('button', { name: /Notifications/ }))
    expect(await screen.findByText(/All · 5/)).toBeTruthy()
    expect(await screen.findByText(/Needs you · 3/)).toBeTruthy()
    expect(await screen.findByText(/Alerts · 1/)).toBeTruthy()
  })

  test('approve from bell calls approve endpoint', async () => {
    serve([item(1, { run_id: 7, kind: 'chore_submitted', pending: true })], 1)
    wrap(<Bell />)
    await userEvent.click(await screen.findByRole('button', { name: /Notifications/ }))
    const approveBtn = await screen.findByRole('button', { name: /Approve/, hidden: true })
    await userEvent.click(approveBtn)
    expect(posts('/chores/7/approve')).toHaveLength(1)
  })

  test('already-handled chore gets no buttons', async () => {
    serve([item(1, { run_id: 7, kind: 'chore_submitted' })])
    wrap(<Bell />)
    await userEvent.click(await screen.findByRole('button', { name: /Notifications/ }))
    await screen.findByText('Item 1')
    expect(screen.queryByRole('button', { name: /Approve/, hidden: true })).toBeNull()
  })

  test('redemption approve and decline hit /redemptions', async () => {
    serve([item(1, { kind: 'redemption_request', redemption_id: 4, pending: true })], 1)
    wrap(<Bell />)
    await userEvent.click(await screen.findByRole('button', { name: /Notifications/ }))
    await userEvent.click(await screen.findByRole('button', { name: /Approve/, hidden: true }))
    expect(apiMock).toHaveBeenCalledWith('/redemptions/4/approve', expect.objectContaining({ method: 'POST' }))
    await userEvent.click(await screen.findByRole('button', { name: /Decline/, hidden: true }))
    expect(apiMock).toHaveBeenCalledWith('/redemptions/4/deny', expect.objectContaining({ method: 'POST' }))
  })

  test('send back from bell needs a note and posts it', async () => {
    serve([item(1, { run_id: 7, kind: 'chore_submitted', pending: true })], 1)
    wrap(<Bell />)
    await userEvent.click(await screen.findByRole('button', { name: /Notifications/ }))
    await userEvent.click(await screen.findByRole('button', { name: /Send back/, hidden: true }))
    expect((screen.getByRole('button', { name: /Send back/, hidden: true }) as HTMLButtonElement).disabled).toBe(true)
    await userEvent.type(screen.getByLabelText('Note for sending back'), 'redo it')
    await userEvent.click(screen.getByRole('button', { name: /Send back/, hidden: true }))
    expect(apiMock).toHaveBeenCalledWith('/chores/7/send-back', expect.objectContaining({ method: 'POST', body: { note: 'redo it' } }))
  })

  test('Escape closes the popover and the bell advertises it', async () => {
    serve([item(1, { run_id: 7 })])
    wrap(<Bell />)
    const bell = await screen.findByRole('button', { name: /Notifications/ })
    await userEvent.click(bell)
    expect(await screen.findByText('Item 1')).toBeTruthy()
    expect(bell.getAttribute('aria-expanded')).toBe('true')
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByText('Item 1')).toBeNull())
    expect(bell.getAttribute('aria-expanded')).toBe('false')
  })

  test('earlier group for read items', async () => {
    const now = new Date().toISOString()
    const yesterday = new Date(Date.now() - 86400000).toISOString()
    serve([
      item(1, { created_at: now, read: false }),
      item(2, { created_at: yesterday, read: true }),
    ])
    wrap(<Bell />)
    await userEvent.click(await screen.findByRole('button', { name: /Notifications/ }))
    const groups = await screen.findAllByText(/^(Today|Earlier)$/)
    expect(groups).toHaveLength(2)
    expect(groups[0].textContent).toBe('Today')
    expect(groups[1].textContent).toBe('Earlier')
  })

  test('Show older fetches the next page before the last id and appends it', async () => {
    apiMock.mockImplementation(async (p) =>
      p === '/notifications'
        ? { items: [item(9), item(8)], unread: 0, has_more: true }
        : p === '/notifications?before=8'
          ? { items: [item(7)], unread: 0, has_more: false }
          : undefined,
    )
    wrap(<Bell />)
    await userEvent.click(await screen.findByRole('button', { name: /Notifications/ }))
    expect(await screen.findByRole('button', { name: /^All · 2\+$/, hidden: true })).toBeTruthy()
    await userEvent.click(await screen.findByRole('button', { name: 'Show older', hidden: true }))
    expect(await screen.findByText('Item 7')).toBeTruthy()
    expect(apiMock).toHaveBeenCalledWith('/notifications?before=8', { kid: false })
    expect(screen.queryByRole('button', { name: 'Show older', hidden: true })).toBeNull()
  })

  test('a failed approve toasts the error and a double click sends one request', async () => {
    const { notifications } = jest.requireMock('@mantine/notifications') as { notifications: { show: Mock } }
    apiMock.mockImplementation(async (p, i) => {
      if (p === '/notifications') return { items: [item(1, { run_id: 7, kind: 'chore_submitted', pending: true })], unread: 1, has_more: false }
      if (p === '/chores/7/approve' && i?.method === 'POST') {
        await new Promise((r) => setTimeout(r, 100))
        throw new Error("This chore isn't waiting for approval.")
      }
      return undefined
    })
    wrap(<Bell />)
    await userEvent.click(await screen.findByRole('button', { name: /Notifications/ }))
    await userEvent.dblClick(await screen.findByRole('button', { name: /Approve/, hidden: true }))
    await waitFor(() => expect(notifications.show).toHaveBeenCalledWith(expect.objectContaining({ message: "This chore isn't waiting for approval." })))
    expect(posts('/chores/7/approve')).toHaveLength(1)
  })

  test('tab counts follow the mockup rules', async () => {
    serve([
      item(1, { kind: 'chore_submitted', run_id: 1, pending: true }),
      item(2, { kind: 'new_device', read: true }),
      item(3, { kind: 'device_bypass', device_id: 9 }),
    ])
    wrap(<Bell />)
    await userEvent.click(await screen.findByRole('button', { name: /Notifications/ }))
    expect(await screen.findByRole('button', { name: 'All · 3', hidden: true })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Needs you · 1', hidden: true })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Alerts · 1', hidden: true })).toBeTruthy()
  })

  test('a pending kid note offers Reply that opens the chore thread', async () => {
    serve([item(1, { kind: 'chore_note', run_id: 7, pending: true })])
    wrap(<Bell />)
    await userEvent.click(await screen.findByRole('button', { name: /Notifications/ }))
    await userEvent.click(await screen.findByRole('button', { name: /Reply/, hidden: true }))
    expect(push).toHaveBeenCalledWith('/?chore=7')
    expect(openChat).toHaveBeenCalledWith('chore', '7')
  })

  test('a bypass alert offers View and Ask <kid>', async () => {
    serve([item(1, { kind: 'device_bypass', device_id: 9, kid_id: 4, kid_name: 'Mia' })])
    wrap(<Bell />)
    await userEvent.click(await screen.findByRole('button', { name: /Notifications/ }))
    await userEvent.click(await screen.findByRole('button', { name: /Ask Mia/, hidden: true }))
    expect(openChat).toHaveBeenCalledWith('private', '4')
    await userEvent.click(screen.getByRole('button', { name: /^View$/, hidden: true }))
    expect(push).toHaveBeenCalledWith('/devices?item=9')
  })

  test('no actions when not pending', async () => {
    serve([item(1, { kind: 'chore_submitted', run_id: 7, pending: false, points: 30 })])
    wrap(<Bell />)
    await userEvent.click(await screen.findByRole('button', { name: /Notifications/ }))
    await screen.findByText('Item 1')
    expect(screen.queryByRole('button', { name: /Approve/, hidden: true })).toBeNull()
    expect(screen.queryByRole('button', { name: /Send back/, hidden: true })).toBeNull()
  })

  test('parent footer links to settings and see all', async () => {
    serve([item(1)])
    wrap(<Bell />)
    await userEvent.click(await screen.findByRole('button', { name: /Notifications/ }))
    expect((await screen.findByRole('link', { name: /Notification settings/, hidden: true })).getAttribute('href')).toBe('/settings?section=notifications')
    expect(screen.getByRole('link', { name: /See all/, hidden: true }).getAttribute('href')).toBe('/notifications')
  })

  test('kid bell has no footer', async () => {
    serve([item(1)])
    wrap(<Bell kid />)
    await userEvent.click(await screen.findByRole('button', { name: /Notifications/ }))
    await screen.findByText('Item 1')
    expect(screen.queryByRole('link', { name: /See all/, hidden: true })).toBeNull()
  })

  test('approving an already-read item refetches the inbox and the buttons go', async () => {
    let pending = true
    apiMock.mockImplementation(async (p, i) => {
      if (p === '/notifications') return { items: [item(1, { run_id: 7, read: true, pending })], unread: 0, has_more: false }
      if (p === '/chores/7/approve' && i?.method === 'POST') pending = false
      return undefined
    })
    wrap(<Bell />)
    await userEvent.click(await screen.findByRole('button', { name: /Notifications/ }))
    await userEvent.click(await screen.findByRole('button', { name: /Approve/, hidden: true }))
    await waitFor(() => expect(screen.queryByRole('button', { name: /Approve/, hidden: true })).toBeNull())
    expect(posts('/notifications/1/read')).toHaveLength(0)
    expect(apiMock.mock.calls.filter((c) => c[0] === '/notifications').length).toBeGreaterThan(1)
  })

  test('kid bell: no pointer, and Earlier rows have no unread dot', async () => {
    serve([item(1, { created_at: new Date(Date.now() - 2 * 86400000).toISOString(), read: false })])
    wrap(<Bell kid />)
    await userEvent.click(await screen.findByRole('button', { name: /Notifications/ }))
    const row = (await screen.findByText('Item 1')).closest('.p-bell-item') as HTMLElement
    expect(row.classList.contains('unread')).toBe(false)
    expect(document.querySelector('.p-bell-arrow')).toBeNull()
  })

  test('parent Earlier rows keep the unread dot', async () => {
    serve([item(1, { created_at: new Date(Date.now() - 2 * 86400000).toISOString(), read: false })])
    wrap(<Bell />)
    await userEvent.click(await screen.findByRole('button', { name: /Notifications/ }))
    const row = (await screen.findByText('Item 1')).closest('.p-bell-item') as HTMLElement
    expect(row.classList.contains('unread')).toBe(true)
  })
})

