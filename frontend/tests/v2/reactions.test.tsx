import { beforeEach, describe, expect, test } from '@jest/globals'
import type { Mock } from 'jest-mock'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MantineProvider } from '@mantine/core'
import { api } from '@/v2/api'
import { ParentBubble } from '@/v2/chat/ParentBubble'
import { MessageActions } from '@/v2/chat/MessageActions'
import { searchEmoji } from '@/v2/chat/emojiData'
import type { ChatMessage } from '@/v2/hooks/useChat'

jest.mock('@/v2/api', () => ({ api: jest.fn() }))
jest.mock('@mantine/notifications', () => ({ notifications: { show: jest.fn() } }))

const apiMock = api as unknown as Mock<(p: string, i?: { method?: string; body?: unknown }) => Promise<unknown>>
const msg = (over: Partial<ChatMessage> = {}): ChatMessage => ({
  id: 5, author_id: 1, author_name: 'Mom', kind: 'user', body: 'hello', photo_url: null,
  created_at: new Date().toISOString(), ...over,
})
const wrap = (ui: React.ReactNode) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MantineProvider env="test">{ui}</MantineProvider>
    </QueryClientProvider>,
  )
const posted = (emoji: string) =>
  waitFor(() =>
    expect(apiMock).toHaveBeenCalledWith('/chat/messages/5/reactions', expect.objectContaining({ method: 'POST', body: { emoji } })),
  )

beforeEach(() => {
  apiMock.mockReset()
  apiMock.mockResolvedValue(undefined)
})

describe('reaction toolbar', () => {
  test('toolbar order: React, Edit, Delete on my message', () => {
    wrap(<ParentBubble m={msg()} mine />)
    const names = screen.getAllByRole('button').map((b) => b.getAttribute('aria-label'))
    expect(names).toEqual(['Add reaction', 'Edit message', 'Delete message'])
    expect(screen.getByRole('button', { name: 'Add reaction' })).toHaveAttribute('title', 'React')
  })

  test("a kid can react to someone else's message but not edit or delete it", () => {
    wrap(
      <MessageActions m={msg({ author_id: 2 })} mine={false} kid onEdit={() => {}}>
        <span>x</span>
      </MessageActions>,
    )
    expect(screen.getByRole('button', { name: 'Add reaction' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /message$/ })).toBeNull()
  })

  test('system messages get no toolbar', () => {
    wrap(<ParentBubble m={msg({ kind: 'system', author_id: null })} mine={false} />)
    expect(screen.queryByRole('button', { name: 'Add reaction' })).toBeNull()
  })

  test('quick row: one click on an emoji POSTs the toggle', async () => {
    wrap(<ParentBubble m={msg()} mine />)
    expect(screen.queryByRole('button', { name: 'React 👍' })).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Add reaction' }))
    for (const e of ['👍', '❤️', '😂', '😮', '😢', '🙏']) expect(screen.getByRole('button', { name: `React ${e}` })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'React 😂' }))
    await posted('😂')
    expect(screen.queryByRole('button', { name: 'React 👍' })).toBeNull()
  })

  test('a quick emoji still works after the picker opened on the way past "+"', async () => {
    wrap(<ParentBubble m={msg()} mine />)
    await userEvent.click(screen.getByRole('button', { name: 'Add reaction' }))
    await userEvent.click(screen.getByRole('button', { name: 'More reactions' }))
    expect(await screen.findByRole('textbox', { name: 'Search emoji' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'React 👍' }))
    await posted('👍')
  })

  test('hovering the reaction button opens the quick row', async () => {
    wrap(<ParentBubble m={msg()} mine />)
    await userEvent.hover(screen.getByRole('button', { name: 'Add reaction' }))
    expect(await screen.findByRole('button', { name: 'React 👍' })).toBeInTheDocument()
  })

  test('more opens a searchable picker; search filters the grid', async () => {
    wrap(<ParentBubble m={msg()} mine />)
    await userEvent.click(screen.getByRole('button', { name: 'Add reaction' }))
    await userEvent.click(screen.getByRole('button', { name: 'More reactions' }))
    const search = await screen.findByRole('textbox', { name: 'Search emoji' })
    await waitFor(() => expect(search).toHaveFocus())
    expect(await screen.findByRole('button', { name: 'pizza' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'red apple' })).toBeInTheDocument()
    await userEvent.type(search, 'pizza')
    expect(screen.queryByRole('button', { name: 'red apple' })).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'pizza' }))
    await posted('🍕')
  })

  test('keyboard: Tab goes from React into the quick row; a pick returns focus to React', async () => {
    wrap(<ParentBubble m={msg()} mine />)
    const react = screen.getByRole('button', { name: 'Add reaction' })
    react.focus()
    await userEvent.keyboard('{Enter}')
    await userEvent.tab()
    expect(screen.getByRole('button', { name: 'React 👍' })).toHaveFocus()
    await userEvent.keyboard('{Enter}')
    await posted('👍')
    expect(react).toHaveFocus()
    expect(screen.queryByRole('button', { name: 'React 👍' })).toBeNull()
  })

  test('picker opened by hover does not take focus; by click it focuses search', async () => {
    wrap(<ParentBubble m={msg()} mine />)
    await userEvent.click(screen.getByRole('button', { name: 'Add reaction' }))
    await userEvent.hover(screen.getByRole('button', { name: 'More reactions' }))
    const search = await screen.findByRole('textbox', { name: 'Search emoji' })
    await new Promise((r) => setTimeout(r, 50))
    expect(search).not.toHaveFocus()
  })

  test('search matches keywords as well as names', () => {
    expect(searchEmoji('lol').map((e) => e.char)).toContain('😂')
    expect(searchEmoji('zzzz-nothing')).toEqual([])
  })
})

describe('reaction chips', () => {
  const reacted = msg({
    reactions: [
      { emoji: '👍', count: 2, mine: true, names: ['Mom', 'Bobby'] },
      { emoji: '😂', count: 1, mine: false, names: ['Bobby'] },
    ],
  })

  test('render counts, who reacted and pressed state', () => {
    wrap(<ParentBubble m={reacted} mine />)
    const up = screen.getByRole('button', { name: '👍 2: Mom, Bobby' })
    expect(up).toHaveAttribute('aria-pressed', 'true')
    expect(up).toHaveAttribute('title', 'Mom, Bobby')
    expect(screen.getByRole('button', { name: '😂 1: Bobby' })).toHaveAttribute('aria-pressed', 'false')
  })

  test('clicking a chip toggles mine', async () => {
    wrap(<ParentBubble m={reacted} mine />)
    await userEvent.click(screen.getByRole('button', { name: '👍 2: Mom, Bobby' }))
    await posted('👍')
  })

  test('a chip is disabled while its toggle is in flight', async () => {
    apiMock.mockReturnValue(new Promise(() => {}))
    wrap(<ParentBubble m={reacted} mine />)
    const up = screen.getByRole('button', { name: '👍 2: Mom, Bobby' })
    await userEvent.click(up)
    await waitFor(() => expect(up).toBeDisabled())
    expect(screen.getByRole('button', { name: '😂 1: Bobby' })).toBeEnabled()
  })

  test('no chips without reactions', () => {
    wrap(<ParentBubble m={msg()} mine />)
    expect(screen.queryByRole('button', { name: /: / })).toBeNull()
  })
})
