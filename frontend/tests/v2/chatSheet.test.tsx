import { beforeEach, expect, test } from '@jest/globals'
import type { Mock } from 'jest-mock'
import { act, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MantineProvider } from '@mantine/core'
import { api } from '@/v2/api'
import { ChatDock } from '@/v2/chat/ChatDock'
import { ParentBubble } from '@/v2/chat/ParentBubble'
import { openChat } from '@/v2/chat/dock'

jest.mock('@mantine/hooks', () => ({ ...jest.requireActual('@mantine/hooks'), useMediaQuery: () => true }))
jest.mock('@/v2/api', () => ({ api: jest.fn() }))
jest.mock('@mantine/notifications', () => ({ notifications: { show: jest.fn() } }))

const apiMock = api as unknown as Mock<(p: string) => Promise<unknown>>
const wrap = (ui: React.ReactElement) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MantineProvider>{ui}</MantineProvider>
    </QueryClientProvider>,
  )

beforeEach(() => {
  apiMock.mockReset()
  apiMock.mockImplementation(async (p) =>
    p === '/chat/threads'
      ? { total: 0, threads: [] }
      : { id: 2, kind: 'private', title: 'Maya', messages: [], has_more: false, members: [] },
  )
})

test('on a parent phone openChat opens a bottom sheet', async () => {
  wrap(<ChatDock meId={1} />)
  act(() => openChat('private', '3'))
  const sheet = await screen.findByRole('dialog')
  expect(sheet).toHaveClass('pt-sheet')
  expect(await screen.findByRole('region', { name: 'Maya' })).toBeInTheDocument()
})

test('a photo reply shows a "Photo N" chip, not literal text', () => {
  const m = { id: 1, author_id: 2, author_name: 'Leo', kind: 'user' as const, body: 'nice', photo_url: null, created_at: '2026-10-27T10:00:00Z', proof_photo_n: 2 }
  wrap(<ParentBubble m={m} mine={false} />)
  expect(screen.getByText('Photo 2')).toHaveClass('pc-quote')
  expect(screen.queryByText(/↪/)).toBeNull()
})
