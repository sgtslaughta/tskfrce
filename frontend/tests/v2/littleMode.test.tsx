import { beforeEach, describe, expect, test } from '@jest/globals'
import type { Mock } from 'jest-mock'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MantineProvider } from '@mantine/core'
import { LittleMode } from '@/v2/kid/modes/LittleMode'
import type { ModeProps } from '@/v2/kid/modes/types'
import { api } from '@/v2/api'
import { fridgeTheme } from '@/v2/theme'
import type { KidChore, KidToday } from '@/v2/types'

jest.mock('@/v2/api', () => ({ ...(jest.requireActual('@/v2/api') as object), api: jest.fn() }))
jest.mock('@mantine/notifications', () => ({ notifications: { show: jest.fn() } }))
const apiMock = api as unknown as Mock<(p: string, i?: unknown) => Promise<unknown>>

const NOW = Date.parse('2026-10-26T17:00:00Z')
const at = (h: number, m = 0) => `2026-10-26T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00Z`

const dog: KidChore = {
  id: 1, title: 'Feed the dog', points: 10, state: 'todo', due_at: at(16, 30),
  type: { id: 1, name: 'Pets', glyph: 'pets' },
  notes: [{ label: 'Need help', glyph: 'help', universal: true }],
  deductions: [{ amount: 5, note: 'Bowl left out', by_name: 'Dad', at: '' }],
}
const trash: KidChore = { id: 2, title: 'Take out trash', points: 5, state: 'todo', due_at: at(16, 45) }
const tidy: KidChore = { id: 3, title: 'Tidy your room', points: 25, state: 'todo', due_at: at(17, 20) }
const bed: KidChore = { id: 4, title: 'Make bed', points: 5, state: 'todo', due_at: at(19, 30) }
const cat: KidChore = { id: 5, title: 'Feed the cat', points: 10, state: 'needs_you' }
const teeth: KidChore = { id: 6, title: 'Brush teeth', points: 5, state: 'done' }

const today = (over: Partial<KidToday> = {}): KidToday => ({
  locked: true, chores: [teeth, tidy, bed, cat, trash, dog], points_balance: 0, age_group: 'little', locks_at: null,
  timezone: 'UTC', ...over,
})
const props = (over: Partial<ModeProps> = {}): ModeProps => ({
  d: today(), name: 'Leo', avatar: '🦁', now: NOW, onDone: jest.fn(), busyId: null, onSeen: jest.fn(), ...over,
})
const wrap = (p: ModeProps) => (
  <QueryClientProvider client={new QueryClient()}>
    <MantineProvider theme={fridgeTheme}>
      <LittleMode {...p} />
    </MantineProvider>
  </QueryClientProvider>
)
const now = () => screen.getByText('Do this now').closest('.l-now') as HTMLElement
const row = (title: string) => screen.getByText(title, { selector: '.l-q b' }).closest('.l-q') as HTMLElement

beforeEach(() => apiMock.mockReset().mockResolvedValue(undefined))

describe('LittleMode', () => {
  test('the overdue chore is "Do this now" and onSeen gets its id', () => {
    const p = props()
    render(wrap(p))
    expect(screen.getByText('Hi Leo!')).toBeInTheDocument()
    expect(within(now()).getByRole('heading', { name: 'Feed the dog' })).toBeInTheDocument()
    expect(within(now()).getByText('Late!')).toBeInTheDocument()
    expect(within(now()).getByText('+10')).toBeInTheDocument()
    expect(p.onSeen).toHaveBeenCalledWith(1)
    expect(screen.getByLabelText('1 of 6 done')).toBeInTheDocument()
  })

  test('the Next row of another overdue chore reads "Late!"; others use little wording', () => {
    render(wrap(props()))
    expect(screen.getByText('Next')).toBeInTheDocument()
    expect(within(row('Take out trash')).getByText('Late!')).toBeInTheDocument()
    expect(within(row('Tidy your room')).getByText('Hurry · 20 min')).toBeInTheDocument()
    expect(within(row('Make bed')).getByText('By 7:30')).toBeInTheDocument()
    expect(within(row('Brush teeth')).getByText('Done')).toBeInTheDocument()
    expect(row('Take out trash')).toHaveAttribute('data-tone', 'late')
    expect(row('Brush teeth')).toHaveAttribute('data-tone', 'done')
    expect(screen.queryByText('Feed the dog', { selector: '.l-q b' })).toBeNull()
  })

  test('"I did it!" calls onDone when ready', async () => {
    const p = props()
    render(wrap(p))
    await userEvent.click(screen.getByRole('button', { name: /I did it!/ }))
    expect(p.onDone).toHaveBeenCalledWith(1)
  })

  test('"I did it!" is disabled until ready, with the reason shown', () => {
    const steps: KidChore = { ...dog, subtasks: [{ id: 11, title: 'Fill bowl', done: false, after_previous: false }] }
    render(wrap(props({ d: today({ chores: [steps] }) })))
    expect(screen.getByRole('button', { name: /I did it!/ })).toBeDisabled()
    expect(screen.getByText('Tick every step first')).toBeInTheDocument()
  })

  test('the ✋ button opens the Tell Mom or Dad sheet', async () => {
    render(wrap(props()))
    expect(screen.queryByText('About: Feed the dog')).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Tell Mom or Dad' }))
    expect(await screen.findByText('About: Feed the dog')).toBeInTheDocument()
  })

  test('locked shows "No games yet"; unlocked shows "Games on!" and still lists chores', () => {
    const { unmount } = render(wrap(props()))
    expect(screen.getByText('No games yet')).toBeInTheDocument()
    unmount()
    render(wrap(props({ d: today({ locked: false }) })))
    expect(screen.getByText('Games on!')).toBeInTheDocument()
    expect(screen.queryByText('No games yet')).toBeNull()
    expect(within(now()).getByRole('heading', { name: 'Feed the dog' })).toBeInTheDocument()
    expect(screen.getByText('Dad took 5 points')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Reply/ })).toBeNull()
    expect(row('Take out trash')).toBeInTheDocument()
  })

  test('nothing to do + one waiting shows "Waiting for Mom or Dad"', () => {
    const p = props({ d: today({ chores: [teeth, cat], locked: false }) })
    render(wrap(p))
    expect(screen.getByText('Waiting for Mom or Dad')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /I did it!/ })).toBeNull()
    expect(row('Feed the cat')).toBeInTheDocument()
    expect(p.onSeen).not.toHaveBeenCalled()
  })

  test('all approved, or zero chores, shows "All done for today!"', () => {
    const { unmount } = render(wrap(props({ d: today({ chores: [teeth], locked: false }) })))
    expect(screen.getByText('All done for today!')).toBeInTheDocument()
    unmount()
    render(wrap(props({ d: today({ chores: [], locked: false }) })))
    expect(screen.getByText('All done for today!')).toBeInTheDocument()
    expect(screen.queryByText('Next')).toBeNull()
  })

  test('a chore taken by a sibling is never "Do this now"; empty deductions render no "0"', () => {
    const taken: KidChore = { ...dog, taken_by: 'Mia', deductions: [] }
    render(wrap(props({ d: today({ chores: [taken, { ...trash, deductions: [] }] }) })))
    expect(within(now()).getByRole('heading', { name: 'Take out trash' })).toBeInTheDocument()
    expect(within(now()).queryByText('0')).toBeNull()
  })

  test('chip times use the family time zone', () => {
    // 19:30Z = 8:30 AM next day in Auckland (+13)
    render(wrap(props({ d: today({ timezone: 'Pacific/Auckland' }) })))
    expect(within(row('Make bed')).getByText('By 8:30')).toBeInTheDocument()
  })
})
