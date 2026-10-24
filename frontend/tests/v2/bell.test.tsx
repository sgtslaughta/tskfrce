import { beforeEach, describe, expect, test } from '@jest/globals'
import type { Mock } from 'jest-mock'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MantineProvider } from '@mantine/core'
import { api } from '@/v2/api'
import { Bell } from '@/v2/components/Bell'

const push = jest.fn()
jest.mock('@/v2/api', () => ({ api: jest.fn() }))
jest.mock('@mantine/notifications', () => ({ notifications: { show: jest.fn() } }))
jest.mock('next/router', () => ({ useRouter: () => ({ push }) }))

const apiMock = api as unknown as Mock<(p: string, i?: { method?: string; kid?: boolean }) => Promise<unknown>>
const item = (id: number, over: object = {}) => ({
  id, kind: 'chore_submitted', title: `Item ${id}`, body: null, created_at: new Date().toISOString(),
  read: false, run_id: null, redemption_id: null, device_id: null, thread_id: null, ...over,
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

  test('lists items in order and routes on click, marking read', async () => {
    serve([
      item(3, { run_id: 7 }),
      item(2, { device_id: 5 }),
      item(1, { redemption_id: 4, read: true }),
    ])
    wrap(<Bell />)
    await userEvent.click(await screen.findByRole('button', { name: /Notifications/ }))
    const titles = (await screen.findAllByText(/^Item \d$/)).map((e) => e.textContent)
    expect(titles).toEqual(['Item 3', 'Item 2', 'Item 1'])
    await userEvent.click(screen.getByText('Item 2'))
    expect(posts('/notifications/2/read')).toHaveLength(1)
    expect(push).toHaveBeenCalledWith('/devices?focus=5')
    await userEvent.click(await screen.findByRole('button', { name: /Notifications/ }))
    await userEvent.click(await screen.findByText('Item 3'))
    expect(push).toHaveBeenCalledWith('/')
    await userEvent.click(await screen.findByRole('button', { name: /Notifications/ }))
    await userEvent.click(await screen.findByText('Item 1'))
    expect(posts('/notifications/1/read')).toHaveLength(0)
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
})
