import { beforeEach, describe, expect, test } from '@jest/globals'
import type { Mock } from 'jest-mock'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MantineProvider } from '@mantine/core'
import { KidChecklist } from '@/v2/kid/KidChecklist'
import { api } from '@/v2/api'
import { fridgeTheme } from '@/v2/theme'
import type { KidChore } from '@/v2/types'

jest.mock('@/v2/api', () => ({ ...(jest.requireActual('@/v2/api') as object), api: jest.fn() }))
jest.mock('@mantine/notifications', () => ({ notifications: { show: jest.fn() } }))
const apiMock = api as unknown as Mock<(p: string, i?: { method?: string; body?: unknown }) => Promise<unknown>>

const wrap = (ui: unknown) => (
  <QueryClientProvider client={new QueryClient()}>
    <MantineProvider theme={fridgeTheme}>{ui as never}</MantineProvider>
  </QueryClientProvider>
)
const n = (label: string, universal = false) => ({ label, glyph: 'x', universal })
const chore = (over: Partial<KidChore> = {}) =>
  ({
    id: 7, title: 'Dishes', points: 5, state: 'todo',
    subtasks: [
      { id: 1, title: 'Rinse', done: false, locked: false },
      { id: 2, title: 'Dry', done: false, locked: true, after_previous: true },
    ],
    notes: [n('Out of supplies'), n('Did part of it'), n('Too messy for one go'), n('Need help', true), n('Ran out of time', true), n("Can't do it today", true)],
    ...over,
  }) as KidChore

beforeEach(() => apiMock.mockReset().mockResolvedValue(undefined))

describe('kid chore behaviour', () => {
  test('locked step is disabled and says what unlocks it', () => {
    render(wrap(<KidChecklist chores={[chore()]} onDone={() => {}} />))
    expect(screen.getByRole('checkbox', { name: 'Dry' })).toBeDisabled()
    expect(screen.getByRole('checkbox', { name: 'Rinse' })).toBeEnabled()
    expect(screen.getByText('Unlocks after step 1')).toBeInTheDocument()
  })
  test('sheet lists type and universal notes and Send posts label and text', async () => {
    render(wrap(<KidChecklist chores={[chore()]} />))
    await userEvent.click(screen.getByRole('button', { name: /Tell a parent/ }))
    for (const l of ['Out of supplies', 'Did part of it', 'Too messy for one go', 'Need help', 'Ran out of time', "Can't do it today"])
      expect(await screen.findByRole('button', { name: l })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled()
    await userEvent.click(screen.getByRole('button', { name: 'Need help' }))
    await userEvent.type(screen.getByLabelText('Add a note (optional)'), 'soap')
    await userEvent.click(screen.getByRole('button', { name: 'Send' }))
    await waitFor(() =>
      expect(apiMock).toHaveBeenCalledWith('/kid/chores/7/note', expect.objectContaining({ method: 'POST', body: { label: 'Need help', text: 'soap' } })),
    )
  })
  test('step deadline chip says by time, or Late once past', () => {
    const soon = new Date(Date.now() + 3600e3).toISOString()
    const past = new Date(Date.now() - 3600e3).toISOString()
    const steps = [
      { id: 1, title: 'Rinse', done: false, due_at: soon },
      { id: 2, title: 'Dry', done: false, due_at: past },
    ]
    render(wrap(<KidChecklist chores={[chore({ subtasks: steps })]} onDone={() => {}} />))
    expect(screen.getByText(/^by \d/)).toBeInTheDocument()
    expect(screen.getByText('Late')).toHaveAttribute('data-tone', 'late')
  })
  test('step deadline is shown in the family time zone', async () => {
    apiMock.mockImplementation(async (path) => (path === '/family' ? { timezone: 'Pacific/Auckland' } : undefined))
    const steps = [{ id: 1, title: 'Rinse', done: false, due_at: '2099-01-01T00:00:00Z' }]
    render(wrap(<KidChecklist chores={[chore({ subtasks: steps })]} onDone={() => {}} />))
    expect(await screen.findByText('by 1:00 PM')).toBeInTheDocument()
  })
  test('sheet closes after a successful send and the note is pressed while selected', async () => {
    render(wrap(<KidChecklist chores={[chore()]} />))
    await userEvent.click(screen.getByRole('button', { name: /Tell a parent/ }))
    const b = await screen.findByRole('button', { name: 'Need help' })
    await userEvent.click(b)
    expect(b).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(screen.getByRole('button', { name: 'Send' }))
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Need help' })).toBeNull())
  })
  test('sent note replaces the button', () => {
    render(wrap(<KidChecklist chores={[chore({ note: { label: 'Need help', text: null, at: '', kid_name: 'A' } })]} />))
    expect(screen.getByText('Note sent: Need help')).toBeInTheDocument()
    expect(screen.getByText('Sent to Mom & Dad')).toBeInTheDocument()
  })
  test('deduction card names who and replies in the chat', async () => {
    const onChat = jest.fn()
    render(wrap(<KidChecklist chores={[chore({ deductions: [{ amount: 10, note: 'Left a mess', by_name: 'Dad', at: '' }] })]} onChat={onChat} />))
    expect(screen.getByText('Dad took 10 points')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Reply' }))
    expect(onChat).toHaveBeenCalledWith(7)
  })
})
