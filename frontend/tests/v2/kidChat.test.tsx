import { beforeEach, describe, expect, test } from '@jest/globals'
import type { Mock } from 'jest-mock'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MantineProvider } from '@mantine/core'
import { KidPage } from '@/v2/kid/KidPage'
import { api, KID_TOKEN_KEY } from '@/v2/api'
import { fridgeTheme } from '@/v2/theme'

jest.mock('@/v2/api', () => ({ ...(jest.requireActual('@/v2/api') as object), api: jest.fn() }))
jest.mock('@mantine/notifications', () => ({ notifications: { show: jest.fn() } }))

const apiMock = api as unknown as Mock<(p: string, i?: { method?: string; kid?: boolean }) => Promise<unknown>>

const th = (id: number, kind: string, title: string, unread: number, over: object = {}) => ({
  id, kind, title, unread, task_id: null, kid_id: null, last_message_at: null, ...over,
})
const threads = {
  total: 5,
  threads: [
    th(1, 'family', 'Family', 1),
    th(2, 'private', 'Mom & Dad', 0, { kid_id: 1 }),
    th(3, 'chore', 'Dishes', 4, { task_id: 7 }),
  ],
}

beforeEach(() => {
  apiMock.mockReset()
  localStorage.setItem(KID_TOKEN_KEY, 'tok')
  localStorage.setItem('task4ce-kid-id', '1')
  apiMock.mockImplementation(async (p) => {
    if (p === '/kid/whoami') return { device: { id: 1, name: 'iPad' }, kids: [{ id: 1, full_name: 'Ana', avatar: '🦊', has_pin: false }] }
    if (p === '/kid/today')
      return { locked: true, points_balance: 0, chores: [{ id: 7, title: 'Dishes', points: 5, state: 'todo' }] }
    if (p === '/chat/threads') return threads
    if (p.startsWith('/chat/threads/chore/7'))
      return { id: 3, kind: 'chore', title: 'Dishes', messages: [], has_more: false }
    if (p.startsWith('/chat/threads/')) return { id: 1, kind: 'family', title: 'Family', messages: [], has_more: false }
    return undefined
  })
})

const renderKid = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MantineProvider theme={fridgeTheme}>
        <KidPage />
      </MantineProvider>
    </QueryClientProvider>,
  )

describe('kid chat', () => {
  test('dock lists only what the API returns, with a summed unread badge', async () => {
    renderKid()
    expect(await screen.findByTestId('dock-unread')).toHaveTextContent('5')
    await userEvent.click(screen.getByRole('button', { name: /^Chat, 5 unread/ }))
    const list = await screen.findByRole('list', { name: 'Conversations' })
    expect(list).toHaveTextContent('Family')
    expect(list).toHaveTextContent('Mom & Dad')
    expect(list).not.toHaveTextContent('Maya')
  })

  test('chore chat link opens its thread with the kid token', async () => {
    renderKid()
    await userEvent.click(await screen.findByRole('button', { name: /^Chat about Dishes/ }))
    await waitFor(() =>
      expect(apiMock).toHaveBeenCalledWith('/chat/threads/chore/7', expect.objectContaining({ kid: true })),
    )
    expect(await screen.findByRole('region', { name: 'Dishes' })).toBeInTheDocument()
  })

  test('chore link shows its unread count', async () => {
    renderKid()
    expect(await screen.findByRole('button', { name: 'Chat about Dishes, 4 unread' })).toBeInTheDocument()
  })
})
