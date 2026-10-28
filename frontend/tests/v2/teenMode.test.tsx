import { beforeEach, describe, expect, test } from '@jest/globals'
import type { Mock } from 'jest-mock'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MantineProvider } from '@mantine/core'
import { TeenMode } from '@/v2/kid/modes/TeenMode'
import { PreviewProvider } from '@/v2/hooks/usePreview'
import type { ModeProps } from '@/v2/kid/modes/types'
import { api } from '@/v2/api'
import { fridgeTheme } from '@/v2/theme'
import type { KidChore, KidToday } from '@/v2/types'

jest.mock('@/v2/api', () => ({ ...(jest.requireActual('@/v2/api') as object), api: jest.fn() }))
jest.mock('@mantine/notifications', () => ({ notifications: { show: jest.fn() } }))
const apiMock = api as unknown as Mock<(p: string, i?: unknown) => Promise<unknown>>

let width = 1280
beforeEach(() => {
  width = 1280
  window.matchMedia = ((q: string) => {
    const min = /min-width:\s*(\d+)px/.exec(q)
    const max = /max-width:\s*(\d+)px/.exec(q)
    const matches = (!min || width >= Number(min[1])) && (!max || width <= Number(max[1]))
    return { matches, media: q, onchange: null, addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false }
  }) as unknown as typeof window.matchMedia
  apiMock.mockReset().mockResolvedValue(undefined)
})

const NOW = Date.parse('2026-10-26T17:00:00Z')
const at = (h: number, m = 0) => `2026-10-26T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00Z`

const bathroom: KidChore = { id: 1, title: 'Clean bathroom', points: 40, state: 'todo', due_at: at(16, 30) }
const homework: KidChore = {
  id: 2, title: 'Homework', points: 30, state: 'todo', due_at: at(19), new: true,
  type: { id: 1, name: 'School', glyph: 'school' },
  subtasks: [
    { id: 21, title: 'Math worksheet', done: true, after_previous: false },
    { id: 22, title: 'Check answers', done: false, after_previous: true, due_at: at(17, 30) },
    { id: 23, title: 'Fix mistakes', done: false, after_previous: true, locked: true },
  ],
}
const dishes: KidChore = { id: 3, title: 'Load dishwasher', points: 20, state: 'todo', sent_back: true, last_note: 'plates face in' }
const cat: KidChore = { id: 4, title: 'Feed the cat', points: 10, state: 'needs_you', done_at: at(16, 1) }
const plants: KidChore = { id: 5, title: 'Water plants', points: 5, state: 'done', done_at: at(9) }
const trash: KidChore = { id: 6, title: 'Take out trash', points: 5, state: 'done', done_at: at(8) }

const today = (over: Partial<KidToday> = {}): KidToday => ({
  locked: true, chores: [plants, homework, dishes, cat, bathroom, trash], points_balance: 860, age_group: 'teen',
  locks_at: at(21), timezone: 'UTC', progress: { level: 3, title: 'x', xp: 0, floor: 0, next: 1, streak: 6 }, ...over,
})
const props = (over: Partial<ModeProps> = {}): ModeProps => ({
  d: today(), name: 'Mia', avatar: null, now: NOW, onDone: jest.fn(), busyId: null, onSeen: jest.fn(), ...over,
})
const wrap = (p: ModeProps) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MantineProvider theme={fridgeTheme}>
      <TeenMode {...p} />
    </MantineProvider>
  </QueryClientProvider>
)
const rows = () => screen.getAllByRole('button').filter((b) => b.classList.contains('t-row'))

describe('TeenMode', () => {
  test('overdue row sorts first and shows "Was due 4:30 PM"', () => {
    render(wrap(props()))
    const list = rows()
    expect(list[0]).toHaveTextContent('Clean bathroom')
    expect(within(list[0]).getByText('Was due 4:30 PM')).toBeInTheDocument()
    expect(within(list[0]).getByText('Overdue')).toBeInTheDocument()
    expect(screen.getByText('Today')).toBeInTheDocument()
    expect(screen.getByText('Monday · Mia')).toBeInTheDocument()
    expect(screen.getByText('Step 2 of 3 · next by 5:30 PM')).toBeInTheDocument()
    expect(screen.getByText('“plates face in”')).toBeInTheDocument()
    expect(screen.getByText('Done 4:01 PM')).toBeInTheDocument()
  })

  test('the filter "Waiting · 1" shows only the waiting chore', async () => {
    render(wrap(props()))
    expect(screen.getByRole('button', { name: 'All · 6' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'To do · 3' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Done · 2' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Waiting · 1' }))
    expect(rows()).toHaveLength(1)
    expect(rows()[0]).toHaveTextContent('Feed the cat')
  })

  test('stats show "2 / 6" and "860"', () => {
    render(wrap(props()))
    expect(screen.getByText('Internet paused')).toBeInTheDocument()
    expect(screen.getByText('3 chores left · 1 waiting · night lock 9:00 PM')).toBeInTheDocument()
    expect(screen.getByText('2 / 6')).toBeInTheDocument()
    expect(screen.getByText('done today')).toBeInTheDocument()
    expect(screen.getByText('860')).toBeInTheDocument()
    expect(screen.getByText('6 days')).toBeInTheDocument()
  })

  test('picking a chore that is not new does not call onSeen', async () => {
    const p = props()
    render(wrap(p))
    await userEvent.click(screen.getByRole('button', { name: /Clean bathroom/ }))
    expect(p.onSeen).not.toHaveBeenCalled()
  })

  test('first row starts selected at 1280; disabled Mark done label; selecting calls onSeen', async () => {
    const p = props()
    render(wrap(p))
    expect(rows()[0]).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('heading', { name: 'Clean bathroom' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Homework/ }))
    expect(p.onSeen).toHaveBeenCalledWith(2)
    expect(screen.getByRole('heading', { name: 'Homework' })).toBeInTheDocument()
    expect(screen.getByText('Steps · in order 1 → 3')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Mark done · finish steps first/ })).toBeDisabled()
    expect(rows().length).toBe(6)
  })

  test('at 800px selecting a row shows "All chores" and hides the list', async () => {
    width = 800
    render(wrap(props()))
    expect(screen.queryByRole('heading', { level: 2 })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Homework/ }))
    expect(screen.getByRole('button', { name: /All chores/ })).toBeInTheDocument()
    expect(screen.queryByText('Clean bathroom')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /All chores/ }))
    expect(rows()).toHaveLength(6)
  })

  test('the unlocked strip shows "Internet on" and the list still renders', () => {
    render(wrap(props({ d: today({ locked: false }) })))
    expect(screen.getByText('Internet on')).toBeInTheDocument()
    expect(screen.getByText('locks at 9:00 PM')).toBeInTheDocument()
    expect(rows()).toHaveLength(6)
  })

  test('ready chore marks done; Latest shows the newest message', async () => {
    apiMock.mockImplementation(async (p: string) =>
      p.startsWith('/chat/threads/chore/5')
        ? { id: 9, kind: 'chore', title: '', has_more: false, messages: [
            { id: 1, author_id: 1, author_name: 'Dad', kind: 'user', body: 'old', photo_url: null, created_at: at(15) },
            { id: 2, author_id: 1, author_name: 'Mom', kind: 'user', body: 'Bring it to me', photo_url: null, created_at: at(16, 20) },
            { id: 3, author_id: null, author_name: null, kind: 'system', body: 'sys', photo_url: null, created_at: at(16, 30) },
          ] }
        : undefined,
    )
    const water: KidChore = { ...plants, state: 'todo', done_at: null }
    const p = props({ d: today({ chores: [water] }), onChat: jest.fn() })
    render(wrap(p))
    expect(await screen.findByText('Mom · 4:20 PM')).toBeInTheDocument()
    expect(screen.getByText('Bring it to me')).toBeInTheDocument()
    expect(screen.getByText('Latest')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /^Mark done$/ }))
    expect(p.onDone).toHaveBeenCalledWith(5)
    await userEvent.click(screen.getByRole('button', { name: /Chat/ }))
    expect(p.onChat).toHaveBeenCalledWith(5)
  })

  test('preview never fetches the chore thread and hides Latest', () => {
    render(<PreviewProvider value={7}>{wrap(props())}</PreviewProvider>)
    expect(screen.getByRole('heading', { name: 'Clean bathroom' })).toBeInTheDocument()
    expect(screen.queryByText('Latest')).not.toBeInTheDocument()
    expect(apiMock.mock.calls.some(([path]) => path.startsWith('/chat'))).toBe(false)
  })

  test('empty deductions render no stray "0"; unlocked still shows a deduction in the detail', () => {
    const { unmount } = render(wrap(props({ d: today({ chores: [{ ...bathroom, deductions: [] }] }) })))
    const detail = screen.getByRole('heading', { name: 'Clean bathroom' }).closest('.t-detail') as HTMLElement
    expect(within(detail).queryByText('0')).not.toBeInTheDocument()
    unmount()
    const fined: KidChore = { ...bathroom, deductions: [{ amount: 5, note: 'Mirror smeared', by_name: 'Dad', at: '' }] }
    render(wrap(props({ d: today({ locked: false, chores: [fined] }) })))
    expect(screen.getByText('Internet on')).toBeInTheDocument()
    expect(screen.getByText('Dad took 5 points')).toBeInTheDocument()
    expect(screen.getByText('“Mirror smeared”')).toBeInTheDocument()
  })

  test('weekday and clocks use the family time zone, and step chips drop AM/PM', () => {
    // 17:00Z Monday = 06:00 Tuesday in Auckland (NZDT, +13)
    render(wrap(props({ d: today({ timezone: 'Pacific/Auckland', chores: [homework, bathroom] }) })))
    expect(screen.getByText('Tuesday · Mia')).toBeInTheDocument()
    expect(screen.getByText('Was due 5:30 AM')).toBeInTheDocument()
    expect(screen.getByText('Step 2 of 3 · next by 6:30 AM')).toBeInTheDocument()
  })

  test('step time chip is short (no AM/PM)', async () => {
    render(wrap(props()))
    await userEvent.click(screen.getByRole('button', { name: /Homework/ }))
    expect(screen.getByText('5:30', { selector: '.k-steps .k-chip' })).toBeInTheDocument()
  })
})
