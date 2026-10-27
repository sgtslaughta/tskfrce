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

const apiMock = api as unknown as Mock<(p: string, i?: object) => Promise<unknown>>
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
const open = () => act(() => openChat('private', '3'))

describe('ChatDock', () => {
  test('has no floating launcher', async () => {
    wrap(<ChatDock meId={1} />)
    await waitFor(() => expect(apiMock).toHaveBeenCalled())
    expect(screen.queryByRole('button', { name: /^Chat/ })).toBeNull()
    expect(screen.queryByTestId('dock-unread')).toBeNull()
  })

  test('openChat opens straight to a thread; back goes to the list', async () => {
    wrap(<ChatDock meId={1} />)
    open()
    expect(await screen.findByRole('region', { name: 'Maya' })).toBeInTheDocument()
    expect(apiMock.mock.calls.some(([p]) => p === '/chat/threads/private/3')).toBe(true)
    await userEvent.click(screen.getByRole('button', { name: 'Back to conversations' }))
    expect(await screen.findByRole('list', { name: 'Conversations' })).toBeInTheDocument()
  })

  test('Escape closes the panel', async () => {
    wrap(<ChatDock meId={1} />)
    open()
    await waitFor(() => expect(screen.getByRole('dialog')).toHaveFocus())
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  test('openChat with a reply target shows a removable Replying to bar', async () => {
    wrap(<ChatDock meId={1} />)
    act(() => openChat('private', '3', { label: 'Photo 1' }))
    expect(await screen.findByTestId('replying')).toHaveTextContent('Replying to Photo 1')
    await userEvent.click(screen.getByRole('button', { name: 'Stop replying' }))
    expect(screen.queryByTestId('replying')).toBeNull()
  })

  test('a photo reply sends the proof photo id, not text', async () => {
    wrap(<ChatDock meId={1} />)
    act(() => openChat('private', '3', { proof_photo_id: 7, label: 'Photo' }))
    await userEvent.type(await screen.findByLabelText('Message'), 'nice{Enter}')
    await waitFor(() =>
      expect(apiMock).toHaveBeenCalledWith(
        '/chat/threads/2/messages',
        expect.objectContaining({ body: expect.objectContaining({ body: 'nice', proof_photo_id: 7 }) }),
      ),
    )
  })

  test('openChat with an invalid ref does nothing', () => {
    wrap(<ChatDock meId={1} />)
    act(() => openChat('private', '../x'))
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
