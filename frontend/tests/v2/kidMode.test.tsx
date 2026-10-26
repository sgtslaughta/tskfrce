import { beforeEach, describe, expect, test } from '@jest/globals'
import type { Mock } from 'jest-mock'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MantineProvider } from '@mantine/core'
import { KidMode } from '@/v2/kid/modes/KidMode'
import type { ModeProps } from '@/v2/kid/modes/types'
import { api } from '@/v2/api'
import { fridgeTheme } from '@/v2/theme'
import type { KidChore, KidToday } from '@/v2/types'

jest.mock('@/v2/api', () => ({ ...(jest.requireActual('@/v2/api') as object), api: jest.fn() }))
jest.mock('@mantine/notifications', () => ({ notifications: { show: jest.fn() } }))
const apiMock = api as unknown as Mock<(p: string, i?: unknown) => Promise<unknown>>

const NOW = Date.parse('2026-10-26T15:00:00Z')
const later = new Date(NOW + 3 * 3_600_000).toISOString()

const kitchen: KidChore = {
  id: 1, title: 'Clean Kitchen', points: 30, state: 'todo', new: true, due_at: later,
  type: { id: 1, name: 'Cleaning', glyph: 'cleaning_services' },
  subtasks: [
    { id: 11, title: 'Wipe counters', done: false, after_previous: false },
    { id: 12, title: 'Sweep floor', done: false, after_previous: true, locked: true },
    { id: 13, title: 'Take out trash', done: false, after_previous: true, locked: true },
  ],
  notes: [{ label: 'Need help', glyph: 'help', universal: true }],
}
const dog: KidChore = {
  id: 2, title: 'Feed the dog', points: 10, state: 'todo',
  deductions: [{ amount: 5, note: 'Bowl left out', by_name: 'Dad', at: '' }],
}
const today = (over: Partial<KidToday> = {}): KidToday => ({
  locked: true, chores: [kitchen, dog], points_balance: 0, age_group: 'kid', locks_at: null, timezone: 'UTC', ...over,
})
const props = (over: Partial<ModeProps> = {}): ModeProps => ({
  d: today(), name: 'Leo', avatar: null, now: NOW, onDone: jest.fn(), busyId: null, onSeen: jest.fn(), ...over,
})
const wrap = (p: ModeProps) => (
  <QueryClientProvider client={new QueryClient()}>
    <MantineProvider theme={fridgeTheme}>
      <KidMode {...p} />
    </MantineProvider>
  </QueryClientProvider>
)

beforeEach(() => apiMock.mockReset().mockResolvedValue(undefined))

describe('KidMode', () => {
  test('locked banner counts the chores left', () => {
    render(wrap(props()))
    expect(screen.getByText('Hi Leo!')).toBeInTheDocument()
    expect(screen.getByText('Internet is paused')).toBeInTheDocument()
    expect(screen.getByText('Finish 2 more chores to turn it on')).toBeInTheDocument()
    expect(screen.getByLabelText('0 of 2 done')).toBeInTheDocument()
  })

  test('unlocked shows tiles and deduction', async () => {
    render(wrap(props({ d: today({ locked: false }) })))
    expect(screen.getByText('Internet is on')).toBeInTheDocument()
    expect(screen.getByText('2 chores left today')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Open Clean Kitchen' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Open Feed the dog' }))
    expect(screen.getByText('Dad took 5 points')).toBeInTheDocument()
  })

  test('opening a tile calls onSeen and shows the back pill', async () => {
    const p = props()
    render(wrap(p))
    await userEvent.click(screen.getByRole('button', { name: 'Open Clean Kitchen' }))
    expect(p.onSeen).toHaveBeenCalledWith(1)
    expect(screen.getByRole('button', { name: /All chores/ })).toBeInTheDocument()
    expect(screen.getByText('Do steps 1 → 3 in order')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /All chores/ }))
    expect(screen.getByText('Internet is paused')).toBeInTheDocument()
  })

  test("I'm done! is disabled until the steps are ticked, with the hint", async () => {
    const p = props()
    const { rerender } = render(wrap(p))
    await userEvent.click(screen.getByRole('button', { name: 'Open Clean Kitchen' }))
    expect(screen.getByRole('button', { name: /I'm done!/ })).toBeDisabled()
    expect(screen.getByText('Finish all the steps to press “I\'m done!”')).toBeInTheDocument()
    const ticked = { ...kitchen, subtasks: kitchen.subtasks!.map((s) => ({ ...s, done: true, locked: false })) }
    rerender(wrap({ ...p, d: today({ chores: [ticked, dog] }) }))
    const btn = screen.getByRole('button', { name: /I'm done!/ })
    expect(btn).toBeEnabled()
    await userEvent.click(btn)
    expect(p.onDone).toHaveBeenCalledWith(1)
  })

  test('the New tile shows exactly 2 chips', () => {
    render(wrap(props()))
    const tile = screen.getByRole('button', { name: 'Open Clean Kitchen' })
    expect(tile.querySelectorAll('.k-chip')).toHaveLength(2)
    expect(within(tile).getByText('New')).toBeInTheDocument()
  })

  test('Chat is absent without onChat and present with it', async () => {
    const { unmount } = render(wrap(props()))
    await userEvent.click(screen.getByRole('button', { name: 'Open Clean Kitchen' }))
    expect(screen.queryByRole('button', { name: /^Chat$/ })).toBeNull()
    expect(screen.getByRole('button', { name: /Tell Mom\/Dad/ })).toBeInTheDocument()
    unmount()
    const onChat = jest.fn()
    render(wrap(props({ onChat })))
    await userEvent.click(screen.getByRole('button', { name: 'Open Clean Kitchen' }))
    await userEvent.click(screen.getByRole('button', { name: /^Chat$/ }))
    expect(onChat).toHaveBeenCalledWith(1)
  })

  test('waiting chore shows no actions', async () => {
    render(wrap(props({ d: today({ chores: [{ ...dog, state: 'needs_you' }] }) })))
    await userEvent.click(screen.getByRole('button', { name: 'Open Feed the dog' }))
    expect(screen.getByText('Waiting for Mom or Dad')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /I'm done!/ })).toBeNull()
  })

  test('empty list', () => {
    render(wrap(props({ d: today({ chores: [], locked: false }) })))
    expect(screen.getByText('No chores today. Enjoy the free time.')).toBeInTheDocument()
    expect(screen.getByText('All done for today. Nice work!')).toBeInTheDocument()
  })
})
