import { render as rtl, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThreadList, when } from '@/v2/chat/ThreadList'
import type { ThreadSummary } from '@/v2/hooks/useChat'

const render = (ui: React.ReactElement) => rtl(<QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>)
const t = (o: Partial<ThreadSummary>): ThreadSummary => ({
  id: 1, kind: 'chore', task_id: 1, kid_id: null, kid_ids: [7], title: 'Brush teeth', unread: 0,
  last_message_at: null, last_text: 'Approved · +10', last_author: null, note: false, glyph: null, ...o,
})

describe('when', () => {
  const now = new Date(2026, 9, 27, 15)
  it('names today and yesterday, else the weekday and date', () => {
    expect(when(new Date(2026, 9, 27, 8).toISOString(), now)).toBe('Today')
    expect(when(new Date(2026, 9, 26, 23).toISOString(), now)).toBe('Yesterday')
    expect(when(new Date(2026, 9, 20, 12).toISOString(), now)).toBe('Tue, Oct 20')
    expect(when(null, now)).toBe('')
  })
})

describe('ThreadList for a kid', () => {
  const threads = [
    t({ id: 1, kind: 'private', task_id: null, kid_id: 7, kid_ids: undefined, title: 'Susan' }),
    t({ id: 2, last_message_at: '2026-10-20T12:00:00' }),
    t({ id: 3, last_message_at: '2026-10-21T12:00:00' }),
  ]

  it('lists flat: no group headed by the kid name, repeated chores carry a date', () => {
    render(<ThreadList threads={threads} selected={null} onPick={() => {}} kid />)
    expect(screen.queryByText('Susan')).toBeNull()
    expect(screen.getByText('Parents')).toBeTruthy()
    expect(screen.queryByText('S')).toBeNull() // tile is the family icon, not the kid's initial
    expect(screen.queryByRole('button', { name: /Show .* chore chat/ })).toBeNull()
    const rows = screen.getAllByText(/Approved · \+10 · \w{3}, Oct \d+/)
    expect(rows).toHaveLength(2)
    expect(new Set(rows.map((r) => r.textContent)).size).toBe(2)
  })

  it('keeps the grouped list for parents', () => {
    render(<ThreadList threads={threads} selected={null} onPick={() => {}} />)
    expect(screen.getByText('Susan')).toBeTruthy()
  })
})
