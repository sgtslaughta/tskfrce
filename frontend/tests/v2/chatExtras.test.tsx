import { afterEach, beforeEach, describe, expect, test } from '@jest/globals'
import type { Mock } from 'jest-mock'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MantineProvider } from '@mantine/core'
import { api } from '@/v2/api'
import { ThreadView } from '@/v2/chat/ThreadView'
import { ThreadList } from '@/v2/chat/ThreadList'
import { TypingLine } from '@/v2/chat/TypingLine'
import { renderMentions } from '@/v2/chat/mentions'
import type { ThreadSummary } from '@/v2/hooks/useChat'

jest.mock('@/v2/api', () => ({ api: jest.fn() }))
jest.mock('@mantine/notifications', () => ({ notifications: { show: jest.fn(), hide: jest.fn() } }))
jest.mock('@mantine/hooks', () => ({ ...jest.requireActual('@mantine/hooks'), useMediaQuery: () => false }))
jest.mock('@/contexts/UnifiedAuthContext', () => ({ useUnifiedAuth: () => ({ user: { id: 1 } }) }))

const apiMock = api as unknown as Mock<(p: string, init?: { method?: string; body?: unknown; kid?: boolean }) => Promise<unknown>>

let state = 'needs_you'
let typing: string[] = []
const members = [
  { id: 1, name: 'Mom' },
  { id: 2, name: 'Mia' },
  { id: 3, name: 'Leo' },
]
const page = (kind: string, title: string) => ({ id: 9, kind, title, messages: [], has_more: false, typing, members })

beforeEach(() => {
  state = 'needs_you'
  typing = []
  apiMock.mockReset().mockImplementation(async (p) => {
    if (p === '/chat/threads') return { total: 0, threads: [] }
    if (p.startsWith('/chat/search')) return { thread_ids: p.includes('fraction') ? [2] : [] }
    if (p.startsWith('/chat/threads/chore/')) return { ...page('chore', 'Make bed · Mia'), run_id: 41 }
    if (p.startsWith('/chat/threads/private/')) return page('private', 'Mia')
    if (p === '/chores/41') return { id: 41, title: 'Make bed', points: 10, state, due_time: null, kid_ids: [2], steps: [], photos: [] }
    if (p === '/family') return { name: 'Fam', quick_replies: ['Looks good', 'Can you redo it?', 'Retake the photo'] }
    if (p === '/today') return { kids: [] }
    if (p.endsWith('/messages')) return { id: 99 }
    return { ok: true }
  })
})
afterEach(() => {
  jest.useRealTimers()
})

const client = () => new QueryClient({ defaultOptions: { queries: { retry: false } } })
const wrap = (ui: React.ReactElement) =>
  render(
    <QueryClientProvider client={client()}>
      <MantineProvider>{ui}</MantineProvider>
    </QueryClientProvider>,
  )
const calls = (pred: (p: string, m?: string) => boolean) => apiMock.mock.calls.filter(([p, i]) => pred(p, i?.method))
const posts = () => calls((p) => p.endsWith('/messages'))
const pings = () => calls((p) => p.endsWith('/typing'))

const th = (id: number, kind: ThreadSummary['kind'], title: string, over: Partial<ThreadSummary> = {}): ThreadSummary => ({
  id, kind, title, task_id: kind === 'chore' ? id : null, kid_id: null, unread: 0, last_message_at: null,
  last_author: null, last_text: 'hello', note: false, glyph: null, ...over,
})
const list = [
  th(1, 'family', 'Family'),
  th(2, 'chore', 'Homework · Mia', { glyph: 'school', last_text: 'ok fixed it' }),
  th(3, 'chore', 'Clean bathroom · Mia', { note: true, last_text: 'Note: Out of supplies' }),
]

describe('ThreadList extras', () => {
  test('Notes tab lists only note threads, with the count and a Note chip', async () => {
    wrap(<ThreadList threads={list} selected={null} onPick={() => {}} />)
    await userEvent.click(screen.getByRole('button', { name: 'Notes · 1' }))
    const rows = screen.getByLabelText('Conversations')
    expect(rows).toHaveTextContent('Clean bathroom · Mia')
    expect(rows).not.toHaveTextContent('Homework · Mia')
    expect(within(rows).getByText('Note')).toBeInTheDocument()
  })

  test('search matches a thread the server found by message text', async () => {
    wrap(<ThreadList threads={list} selected={null} onPick={() => {}} />)
    await userEvent.type(screen.getByLabelText('Search threads'), 'fraction')
    expect(await screen.findByText('Homework · Mia')).toBeInTheDocument()
    expect(screen.queryByText('Clean bathroom · Mia')).toBeNull()
  })
})

describe('TypingLine', () => {
  test.each([
    [['Mia'], 'Mia is typing…'],
    [['Mia', 'Leo'], 'Mia and Leo are typing…'],
    [['Mia', 'Leo', 'Sam'], '3 people are typing…'],
  ])('%p', (names, text) => {
    render(<TypingLine names={names} />)
    expect(screen.getByText(text)).toBeInTheDocument()
    expect(screen.getByText(text).closest('[aria-live]')).toHaveAttribute('aria-live', 'polite')
  })
})

describe('renderMentions', () => {
  test('wraps a known name, case-insensitive, as text inside <b>', () => {
    const { container } = render(<p>{renderMentions('hi @mia and @bob', ['Mia'])}</p>)
    const b = container.querySelectorAll('b.pc-mention')
    expect(b).toHaveLength(1)
    expect(b[0]).toHaveTextContent('@mia')
    expect(container).toHaveTextContent('hi @mia and @bob')
  })
})

describe('composer', () => {
  test('several keystrokes within 3 s send one typing ping', async () => {
    jest.useFakeTimers()
    wrap(<ThreadView kind="private" refId="2" meId={1} />)
    const box = await screen.findByLabelText('Message')
    await waitFor(() => expect(screen.getByRole('button', { name: 'Mention someone' })).toBeEnabled())
    fireEvent.change(box, { target: { value: 'h' } })
    fireEvent.change(box, { target: { value: 'hi' } })
    act(() => jest.advanceTimersByTime(1000))
    fireEvent.change(box, { target: { value: 'hi!' } })
    expect(pings()).toHaveLength(1)
    expect(pings()[0][0]).toBe('/chat/threads/9/typing')
    act(() => jest.advanceTimersByTime(3000))
    fireEvent.change(box, { target: { value: 'hi!!' } })
    expect(pings()).toHaveLength(2)
  })

  test('the @ button opens the menu; picking Mia inserts "@Mia "', async () => {
    wrap(<ThreadView kind="private" refId="2" meId={1} />)
    const box = await screen.findByLabelText('Message')
    await waitFor(() => expect(screen.getByRole('button', { name: 'Mention someone' })).toBeEnabled())
    await userEvent.click(screen.getByRole('button', { name: 'Mention someone' }))
    const menu = await screen.findByRole('listbox', { name: 'Mention' })
    expect(within(menu).queryByText('Mom')).toBeNull() // not me
    await userEvent.click(within(menu).getByRole('option', { name: 'Mia' }))
    expect(box).toHaveValue('@Mia ')
    expect(screen.queryByRole('listbox', { name: 'Mention' })).toBeNull()
  })

  test('typing @le filters the menu, Enter picks, Esc closes', async () => {
    wrap(<ThreadView kind="private" refId="2" meId={1} />)
    const box = await screen.findByLabelText('Message')
    await waitFor(() => expect(screen.getByRole('button', { name: 'Mention someone' })).toBeEnabled())
    await userEvent.type(box, 'yo @le')
    const menu = await screen.findByRole('listbox', { name: 'Mention' })
    expect(within(menu).queryByText('Mia')).toBeNull()
    await userEvent.keyboard('{Enter}')
    expect(box).toHaveValue('yo @Leo ')
    expect(posts()).toHaveLength(0)
    await userEvent.type(box, '@')
    expect(await screen.findByRole('listbox', { name: 'Mention' })).toBeInTheDocument()
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('listbox', { name: 'Mention' })).toBeNull()
  })

  test('shows who is typing at the bottom of the messages', async () => {
    typing = ['Mia']
    wrap(<ThreadView kind="private" refId="2" meId={1} />)
    expect(await screen.findByText('Mia is typing…')).toBeInTheDocument()
  })
})

describe('kid composer', () => {
  test('kids get the @ button, the mention menu and the typing line, no quick replies', async () => {
    typing = ['Leo']
    wrap(<ThreadView kind="chore" refId="41" meId={2} kid />)
    const box = await screen.findByLabelText('Message')
    expect(await screen.findByText('Leo is typing…')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Edit replies' })).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Mention someone' }))
    const menu = await screen.findByRole('listbox', { name: 'Mention' })
    expect(within(menu).queryByText('Mia')).toBeNull() // the kid herself
    await userEvent.click(within(menu).getByRole('option', { name: 'Mom' }))
    expect(box).toHaveValue('@Mom ')
    fireEvent.change(box, { target: { value: '@Mom hi' } })
    await waitFor(() => expect(pings()).toHaveLength(1))
    expect(pings()[0][1]).toEqual(expect.objectContaining({ method: 'POST', kid: true }))
    // the parent-only run detail would 401 and log the kid out
    expect(calls((p) => p.startsWith('/chores/'))).toHaveLength(0)
  })

  test('a sibling picks Mia from the menu and gets "@Mia "', async () => {
    wrap(<ThreadView kind="chore" refId="41" meId={3} kid />)
    const box = await screen.findByLabelText('Message')
    await waitFor(() => expect(screen.getByRole('button', { name: 'Mention someone' })).toBeEnabled())
    await userEvent.click(screen.getByRole('button', { name: 'Mention someone' }))
    await userEvent.click(within(await screen.findByRole('listbox', { name: 'Mention' })).getByRole('option', { name: 'Mia' }))
    expect(box).toHaveValue('@Mia ')
  })
})

describe('quick replies', () => {
  const chore = () => wrap(<ThreadView kind="chore" refId="41" meId={1} />)

  test('tapping a reply fills the composer and sends nothing; Send posts the edited text', async () => {
    chore()
    const box = await screen.findByLabelText('Message')
    await userEvent.type(box, 'old draft')
    await userEvent.click(await screen.findByRole('button', { name: 'Looks good' }))
    expect(box).toHaveValue('Looks good')
    expect(box).toHaveFocus()
    expect(posts()).toHaveLength(0)
    await userEvent.type(box, ', thanks')
    await userEvent.click(screen.getByRole('button', { name: 'Send' }))
    await waitFor(() => expect(posts()).toHaveLength(1))
    expect(posts()[0][1]?.body).toEqual({ body: 'Looks good, thanks', photo_id: null })
  })

  test('Approve + Great job approves, then posts "Great job!" after the undo delay', async () => {
    jest.useFakeTimers()
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
    chore()
    await user.click(await screen.findByRole('button', { name: 'Approve + “Great job!”' }))
    expect(calls((p) => p === '/chores/41/approve')).toHaveLength(0)
    await act(async () => {
      jest.advanceTimersByTime(5000)
    })
    await waitFor(() => expect(posts()).toHaveLength(1))
    const order = apiMock.mock.calls.map(([p]) => p)
    expect(order.indexOf('/chores/41/approve')).toBeGreaterThan(-1)
    expect(order.indexOf('/chores/41/approve')).toBeLessThan(order.findIndex((p) => p.endsWith('/messages')))
    expect(posts()[0][1]?.body).toEqual({ body: 'Great job!', photo_id: null })
  })

  test('no Approve + Great job chip when the run is still to do', async () => {
    state = 'todo'
    chore()
    expect(await screen.findByRole('button', { name: 'Looks good' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Great job/ })).toBeNull()
  })

  test('the editor saves the edited list to the family', async () => {
    chore()
    await userEvent.click(await screen.findByRole('button', { name: 'Edit replies' }))
    const dlg = await screen.findByRole('dialog', { name: 'Quick replies' })
    await userEvent.click(within(dlg).getByRole('button', { name: 'Remove “Retake the photo”' }))
    await userEvent.click(within(dlg).getByRole('button', { name: 'Move “Can you redo it?” up' }))
    await userEvent.type(within(dlg).getByLabelText('New reply'), 'Nice work')
    await userEvent.click(within(dlg).getByRole('button', { name: 'Add' }))
    await userEvent.click(within(dlg).getByRole('button', { name: 'Save' }))
    await waitFor(() =>
      expect(calls((p, m) => p === '/family' && m === 'PATCH')[0]?.[1]?.body).toEqual({
        quick_replies: ['Can you redo it?', 'Looks good', 'Nice work'],
      }),
    )
  })
})
