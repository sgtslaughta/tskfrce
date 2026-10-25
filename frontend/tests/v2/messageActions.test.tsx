import { beforeEach, describe, expect, test } from '@jest/globals'
import type { Mock } from 'jest-mock'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MantineProvider } from '@mantine/core'
import { api } from '@/v2/api'
import { ParentBubble } from '@/v2/chat/ParentBubble'
import type { ChatMessage } from '@/v2/hooks/useChat'
import { MessageActions, allowed } from '@/v2/chat/MessageActions'

jest.mock('@/v2/api', () => ({ api: jest.fn() }))
jest.mock('@mantine/notifications', () => ({ notifications: { show: jest.fn() } }))

const apiMock = api as unknown as Mock<(p: string, i?: { method?: string; body?: unknown }) => Promise<unknown>>
const msg = (over: Partial<ChatMessage> = {}): ChatMessage => ({
  id: 5, author_id: 1, author_name: 'Mom', kind: 'user', body: 'hello', photo_url: null,
  created_at: new Date().toISOString(), ...over,
})
const wrap = (m: ChatMessage, mine: boolean) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MantineProvider>
        <ParentBubble m={m} mine={mine} />
      </MantineProvider>
    </QueryClientProvider>,
  )

beforeEach(() => {
  apiMock.mockReset()
  apiMock.mockResolvedValue(undefined)
})

describe('message actions', () => {
  test('own message: Edit and Delete', async () => {
    wrap(msg(), true)
    expect(screen.getByRole('button', { name: 'Edit message' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Delete message' })).toBeInTheDocument()
  })

  test("parent sees only Delete on someone else's message", async () => {
    wrap(msg({ author_id: 2 }), false)
    expect(screen.getByRole('button', { name: 'Delete message' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Edit message' })).toBeNull()
  })

  test('step reply shows its quote line; a kid note renders as an amber note bubble', () => {
    wrap(msg({ step_id: 7, step_title: 'Make bed' }), true)
    expect(screen.getByText('Make bed')).toHaveClass('pc-quote')
    wrap(msg({ id: 6, author_id: 2, author_name: 'Mia', note_label: 'Out of supplies' }), false)
    expect(screen.getByText(/note: Out of supplies/)).toBeInTheDocument()
    expect(screen.getByTestId('msg-other')).toHaveAttribute('data-note', 'true')
  })

  test('system messages have no actions', () => {
    wrap(msg({ kind: 'system', author_id: null }), false)
    expect(screen.queryByRole('button', { name: /message$/ })).toBeNull()
  })

  test('edit saves with PATCH on Enter; label shows when edited', async () => {
    wrap(msg(), true)
    await userEvent.click(screen.getByRole('button', { name: 'Edit message' }))
    const box = screen.getByRole('textbox', { name: 'Edit message' })
    await userEvent.clear(box)
    await userEvent.type(box, 'new text{Enter}')
    await waitFor(() =>
      expect(apiMock).toHaveBeenCalledWith('/chat/messages/5', expect.objectContaining({ method: 'PATCH', body: { body: 'new text' } })),
    )
    await waitFor(() => expect(screen.queryByRole('textbox', { name: 'Edit message' })).toBeNull())
  })

  test('Esc cancels without saving', async () => {
    wrap(msg(), true)
    await userEvent.click(screen.getByRole('button', { name: 'Edit message' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Edit message' }), { target: { value: 'zzz' } })
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Edit message' }), { key: 'Escape' })
    expect(screen.queryByRole('textbox', { name: 'Edit message' })).toBeNull()
    expect(screen.getByText('hello')).toBeInTheDocument()
    expect(apiMock).not.toHaveBeenCalled()
  })

  test('delete asks first, then calls DELETE', async () => {
    wrap(msg(), true)
    await userEvent.click(screen.getByRole('button', { name: 'Delete message' }))
    expect(apiMock).not.toHaveBeenCalled()
    await userEvent.click(await screen.findByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(apiMock).toHaveBeenCalledWith('/chat/messages/5', expect.objectContaining({ method: 'DELETE' })))
  })

  test('edited label', () => {
    wrap(msg({ edited_at: new Date().toISOString() }), true)
    expect(screen.getByText('edited')).toBeInTheDocument()
  })
})

describe('kid rules', () => {
  const kidBubble = (m: ChatMessage, mine: boolean) =>
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MantineProvider>
          <MessageActions m={m} mine={mine} kid onEdit={() => {}}>
            <span>x</span>
          </MessageActions>
        </MantineProvider>
      </QueryClientProvider>,
    )

  test('kid: own fresh message has actions; old or others have none', () => {
    kidBubble(msg(), true)
    expect(screen.getByRole('button', { name: 'Edit message' })).toBeInTheDocument()
  })
  test('kid: nothing after 5 minutes or on others', () => {
    expect(allowed(msg({ created_at: new Date(Date.now() - 6 * 60_000).toISOString() }), true, true)).toEqual({ edit: false, del: false })
    expect(allowed(msg({ author_id: 2 }), false, true)).toEqual({ edit: false, del: false })
  })
})
