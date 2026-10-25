import { beforeEach, expect, test } from '@jest/globals'
import type { Mock } from 'jest-mock'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MantineProvider } from '@mantine/core'
import type { ReactNode } from 'react'
import { api } from '@/v2/api'
import ChatPage from '../../pages/chat'

const router = { pathname: '/chat', query: {} as Record<string, string>, push: jest.fn(), replace: jest.fn() }
jest.mock('next/router', () => ({ useRouter: () => router }))
jest.mock('@/v2/api', () => ({ api: jest.fn() }))
jest.mock('@mantine/notifications', () => ({ notifications: { show: jest.fn() } }))
jest.mock('@/contexts/UnifiedAuthContext', () => ({ useUnifiedAuth: () => ({ user: { id: 1 } }) }))
jest.mock('@/v2/components/RequireParent', () => ({ RequireParent: ({ children }: { children: ReactNode }) => <>{children}</> }))
jest.mock('@/v2/parent/ParentShell', () => ({
  ParentShell: ({ list, children }: { list: ReactNode; children: ReactNode }) => (
    <>
      {list}
      {children}
    </>
  ),
}))

const apiMock = api as unknown as Mock<(p: string, init?: object) => Promise<unknown>>
const threads = [
  { id: 1, kind: 'family', task_id: null, kid_id: null, title: 'Family', unread: 0, last_message_at: null, last_author: null, last_text: null },
  { id: 7, kind: 'private', task_id: null, kid_id: 2, title: 'Bobby', unread: 0, last_message_at: null, last_author: null, last_text: null },
]

beforeEach(() => {
  apiMock.mockReset().mockImplementation(async (p) =>
    p === '/chat/threads' ? { total: 2, threads } : { id: 1, kind: 'x', title: 't', messages: [], has_more: false },
  )
  router.query = {}
  router.push.mockClear()
})

const show = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MantineProvider>
        <ChatPage />
      </MantineProvider>
    </QueryClientProvider>,
  )

test('opens threads by their chat ref, not the thread id', async () => {
  router.query = { item: 'private:2' }
  show()
  await waitFor(() => expect(apiMock).toHaveBeenCalledWith('/chat/threads/private/2', expect.anything()))
  await userEvent.click(within(await screen.findByRole('list', { name: 'Conversations' })).getByRole('button', { name: /family/i }))
  expect(router.push).toHaveBeenCalledWith({ query: { item: 'family:family' } }, undefined, { shallow: true })
})

test('desktop opens the first thread when none is picked', async () => {
  show()
  await waitFor(() => expect(apiMock).toHaveBeenCalledWith('/chat/threads/family/family', expect.anything()))
})
