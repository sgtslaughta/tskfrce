import { beforeEach, describe, expect, test } from '@jest/globals'
import type { Mock } from 'jest-mock'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MantineProvider } from '@mantine/core'
import { api } from '@/v2/api'
import { ChatDock } from '@/v2/chat/ChatDock'
import { openChat } from '@/v2/chat/dock'

jest.mock('@/v2/parent/useLook', () => ({
  useLook: jest.fn(),
}))
jest.mock('@/v2/parent/ParentShell', () => ({
  ParentShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

jest.mock('@/v2/api', () => ({ api: jest.fn() }))
jest.mock('@mantine/notifications', () => ({ notifications: { show: jest.fn() } }))
jest.mock('next/router', () => ({ useRouter: () => ({ pathname: '/', query: {}, replace: jest.fn() }) }))
jest.mock('@/contexts/UnifiedAuthContext', () => ({ useUnifiedAuth: () => ({ logout: jest.fn(), user: { id: 1 } }) }))

const apiMock = api as unknown as Mock<(p: string) => Promise<unknown>>
const th = (id: number, kind: string, title: string, unread: number, over: object = {}) => ({
  id, kind, title, unread, task_id: null, kid_id: null, last_message_at: null, ...over,
})
const threads = { total: 3, threads: [th(1, 'family', 'Family', 1), th(2, 'private', 'Maya', 2, { kid_id: 3 })] }

beforeEach(() => {
  sessionStorage.clear()
  apiMock.mockReset()
  apiMock.mockImplementation(async (p) => {
    if (p === '/chat/threads') return threads
    if (p.startsWith('/chat/threads/private/')) return { id: 2, kind: 'private', title: 'Maya', messages: [], has_more: false }
    if (p.startsWith('/chat/threads/')) return { id: 1, kind: 'family', title: 'Family', messages: [], has_more: false }
    return undefined
  })
})

const wrap = (ui: React.ReactElement) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MantineProvider>{ui}</MantineProvider>
    </QueryClientProvider>,
  )
const launcher = () => screen.getByRole('button', { name: /^Chat/ })

describe('ChatDock', () => {
  test('launcher shows the unread total', async () => {
    wrap(<ChatDock meId={1} />)
    expect(await screen.findByTestId('dock-unread')).toHaveTextContent('3')
    expect(launcher()).toHaveAttribute('aria-expanded', 'false')
  })

  test('opens to the list, picks a thread, goes back', async () => {
    wrap(<ChatDock meId={1} />)
    await userEvent.click(launcher())
    expect(screen.getByRole('dialog', { name: 'Chat' })).toBeInTheDocument()
    expect(launcher()).toHaveAttribute('aria-expanded', 'true')
    await userEvent.click(await screen.findByRole('button', { name: /Maya/ }))
    expect(await screen.findByRole('region', { name: 'Maya' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Back to conversations' }))
    expect(await screen.findByRole('list', { name: 'Conversations' })).toBeInTheDocument()
  })

  test('Escape closes and returns focus to the launcher', async () => {
    wrap(<ChatDock meId={1} />)
    await userEvent.click(launcher())
    await waitFor(() => expect(screen.getByRole('dialog')).toHaveFocus())
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(launcher()).toHaveFocus()
  })

  test('openChat opens straight to a thread', async () => {
    wrap(<ChatDock meId={1} />)
    act(() => openChat('private', '3'))
    expect(await screen.findByRole('region', { name: 'Maya' })).toBeInTheDocument()
    expect(apiMock.mock.calls.some(([p]) => p === '/chat/threads/private/3')).toBe(true)
  })

  test('openChat with an invalid ref does nothing', () => {
    wrap(<ChatDock meId={1} />)
    act(() => openChat('private', '../x'))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  test('ChatDock mounts and shows unread count', async () => {
    wrap(<ChatDock meId={1} />)
    expect(await screen.findByTestId('dock-unread')).toBeInTheDocument()
  })
})
