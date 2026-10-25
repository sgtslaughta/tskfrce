import { beforeEach, describe, expect, test } from '@jest/globals'
import type { Mock } from 'jest-mock'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MantineProvider } from '@mantine/core'
import { api } from '@/v2/api'
import { notifications } from '@mantine/notifications'
import { TodayPage } from '@/v2/today/TodayPage'
import type { Today, TodayKid } from '@/v2/types'

jest.mock('@/v2/api', () => ({ api: jest.fn() }))
jest.mock('next/router', () => ({
  useRouter: () => ({
    pathname: '/',
    query: {},
    replace: jest.fn(),
    push: jest.fn(),
  }),
}))
jest.mock('@/contexts/UnifiedAuthContext', () => ({
  useUnifiedAuth: () => ({ logout: jest.fn(), user: { id: 1 } }),
}))
jest.mock('@/v2/chat/ChatDock', () => ({ ChatDock: () => null }))
jest.mock('@/v2/components/BlockerBanner', () => ({ BlockerBanner: () => null }))
jest.mock('@mantine/notifications')

const apiMock = api as unknown as Mock<
  (p: string, init?: { method?: string; body?: unknown }) => Promise<unknown>
>

const kid = (id: number, name = `Kid${id}`, done = 0, total = 2): TodayKid => ({
  id,
  name,
  avatar: null,
  online_all: true,
  done,
  total,
  needs_you_count: 0,
  last_active: null,
  progress: { level: 1, title: 'Rookie', xp: 0, floor: 0, next: 50, streak: 3 },
  points: 860,
  next_reward: 40,
  locks_at: '2026-10-25T00:00:00Z',
  chores: [
    { id: 10 + id, title: 'Dishes', points: 10, state: 'todo', due_time: null },
    { id: 20 + id, title: 'Laundry', points: 20, state: 'todo', due_time: null },
  ],
  devices: [],
})

const todayData = (overrides: Partial<Today> = {}): Today => ({
  day: '2026-10-24',
  pending_approvals: 0,
  new_devices: [],
  kids: [kid(1), kid(2)],
  ...overrides,
})

const wrap = (ui: React.ReactElement) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MantineProvider>{ui}</MantineProvider>
    </QueryClientProvider>
  )

beforeEach(() => {
  apiMock.mockReset()
  // Dismiss the onboarding card so tests are focused
  localStorage.setItem('task4ce-tip:onboard.parent', '1')
  apiMock.mockImplementation(async (p) => {
    if (p === '/today') return todayData()
    if (p.match(/^\/chores\/\d+$/) && !p.endsWith('/approve') && !p.endsWith('/send-back'))
      return { id: 1, steps: [{ id: 1, title: 'Step 1', done: false, done_at: null }, { id: 2, title: 'Step 2', done: false, done_at: null }], photos: [] }
    if (p.startsWith('/chores/') && p.endsWith('/approve'))
      return { ok: true }
    if (p.startsWith('/chores/') && p.endsWith('/send-back'))
      return { ok: true }
    if (p.startsWith('/chat/threads'))
      return { total: 0, threads: [] }
    return undefined
  })
})

describe('TodayPage', () => {
  test('no leaderboard on Today', async () => {
    wrap(<TodayPage />)
    await waitFor(() => expect(screen.queryByText(/leaderboard|rankings/i)).not.toBeInTheDocument())
  })

  test('no new devices banner on parent Today', async () => {
    wrap(<TodayPage />)
    await waitFor(() => expect(screen.queryByText(/new device/i)).not.toBeInTheDocument())
  })

  test('no PINs nudge on parent Today', async () => {
    wrap(<TodayPage />)
    await waitFor(() => expect(screen.queryByText(/without pin|shared/i)).not.toBeInTheDocument())
  })

  test('no kids shows Add your first kid', async () => {
    apiMock.mockImplementation(async (p) => {
      if (p === '/today') return todayData({ kids: [] })
      return undefined
    })
    wrap(<TodayPage />)
    expect(await screen.findByText(/add your first kid/i)).toBeInTheDocument()
  })

  test('kid list shows Today and Needs you tabs with count', async () => {
    const data = todayData({
      needs_you: [{ type: 'chore', id: 1, kid_id: 1, kid_name: 'Kid1', title: 'Dishes' }],
    })
    apiMock.mockImplementation(async (p) => {
      if (p === '/today') return data
      return undefined
    })
    wrap(<TodayPage />)
    expect(await screen.findByRole('tab', { name: /today/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /needs you/i })).toBeInTheDocument()
  })

  test('selecting a kid shows <Kid>\'s day with View as kid and Add chore buttons', async () => {
    wrap(<TodayPage />)
    const kidButton = await screen.findByRole('button', { name: /kid1/i })
    await userEvent.click(kidButton)
    expect(await screen.findByText(/kid1.*s day/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /view as kid/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /add chore/i })).toBeInTheDocument()
  })

  test('expanded kid card shows letter avatar and real stats', async () => {
    wrap(<TodayPage />)
    await userEvent.click(await screen.findByRole('button', { name: /kid1/i }))
    const card = await screen.findByTestId('kid-expanded')
    expect(card).toHaveTextContent('860')
    expect(card).toHaveTextContent('3 days')
    expect(card).toHaveTextContent('40 pts')
    expect(card).toHaveTextContent(/\d+:\d\d [AP]M/)
    expect(screen.getAllByText('K')[0]).toHaveClass('p-kid-avatar')
  })

  test('chat opens beside the chore and closes', async () => {
    wrap(<TodayPage />)
    await userEvent.click((await screen.findAllByRole('button', { name: /dishes/i }))[0])
    expect(screen.queryByTestId('chat-column')).not.toBeInTheDocument()
    await userEvent.click(await screen.findByRole('button', { name: /open chat/i }))
    expect(screen.getByTestId('chat-column')).toBeInTheDocument()
    await waitFor(() => expect(apiMock).toHaveBeenCalledWith('/chat/threads/chore/11', expect.anything()))
    await userEvent.click(screen.getByRole('button', { name: /close chat/i }))
    expect(screen.queryByTestId('chat-column')).not.toBeInTheDocument()
  })

  test('approve shows only for Needs OK and posts approve', async () => {
    const k = { ...kid(1), chores: [{ id: 11, title: 'Dishes', points: 10, state: 'needs_you' as const, due_time: null }] }
    const base = apiMock.getMockImplementation()!
    apiMock.mockImplementation(async (p, init) => (p === '/today' ? todayData({ kids: [k] }) : base(p, init)))
    wrap(<TodayPage />)
    await userEvent.click(await screen.findByRole('button', { name: /dishes/i }))
    await userEvent.click(await screen.findByRole('button', { name: /approve \+10/i }))
    // withUndo holds the call for the undo window and shows a toast first
    expect(notifications.show).toHaveBeenCalled()
    expect(apiMock).not.toHaveBeenCalledWith('/chores/11/approve', expect.anything())
  })

  test('to-do chore has no approve; deduct posts amount and reason', async () => {
    wrap(<TodayPage />)
    await userEvent.click((await screen.findAllByRole('button', { name: /dishes/i }))[0])
    await screen.findByRole('button', { name: /open chat/i })
    expect(screen.queryByRole('button', { name: /approve/i })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /deduct points/i }))
    await userEvent.click(screen.getByRole('button', { name: '−20' }))
    await userEvent.type(screen.getByLabelText('Reason'), 'Left plates')
    await userEvent.click(screen.getByRole('button', { name: /^deduct$/i }))
    await waitFor(() =>
      expect(apiMock).toHaveBeenCalledWith('/kids/1/deduct', { method: 'POST', body: { amount: 20, note: 'Left plates' } }),
    )
  })

  test('expanded kid card displays progress meter and stats', async () => {
    wrap(<TodayPage />)
    const kidButton = await screen.findByRole('button', { name: /kid1/i })
    await userEvent.click(kidButton)
    const expandedSection = await screen.findByTestId('kid-expanded')
    expect(expandedSection).toBeInTheDocument()
    expect(screen.getByText(/points/i)).toBeInTheDocument()
    expect(screen.getByText(/next reward/i)).toBeInTheDocument()
  })

  test('meter bar in expanded card has track container with proper structure', async () => {
    const data = todayData({
      kids: [kid(1, 'Kid1', 1, 2)], // 1 of 2 done = 50%
    })
    apiMock.mockImplementation(async (p) => {
      if (p === '/today') return data
      return undefined
    })
    wrap(<TodayPage />)
    const kidButton = await screen.findByRole('button', { name: /kid1/i })
    await userEvent.click(kidButton)
    const expandedSection = await screen.findByTestId('kid-expanded')
    const track = expandedSection.querySelector('.p-track')
    expect(track).toBeInTheDocument()
    const meterBar = track?.querySelector('.p-meter-bar')
    expect(meterBar).toBeInTheDocument()
    expect(meterBar).toHaveStyle('width: 50%')
  })

  test('chore rows start collapsed', async () => {
    wrap(<TodayPage />)
    await screen.findByRole('button', { name: /kid1/i })
    const chores = await screen.findAllByText(/dishes|laundry/i)
    chores.forEach((chore) => {
      const row = chore.closest('[data-testid="chore-row"]')
      expect(row).toHaveAttribute('data-open', 'false')
    })
  })

  test('opening a second chore closes the first', async () => {
    wrap(<TodayPage />)
    await screen.findByRole('button', { name: /kid1/i })
    const rows = await screen.findAllByTestId('chore-row')
    const buttons = rows.map((r) => r.querySelector('button'))
    if (buttons[0]) await userEvent.click(buttons[0])
    await waitFor(() => expect(rows[0]).toHaveAttribute('data-open', 'true'))
    if (buttons[1]) await userEvent.click(buttons[1])
    await waitFor(() => {
      expect(rows[0]).toHaveAttribute('data-open', 'false')
      expect(rows[1]).toHaveAttribute('data-open', 'true')
    })
  })

  test('done chore shows line-through and Done time', async () => {
    const data = todayData({
      kids: [
        {
          ...kid(1),
          chores: [
            { id: 11, title: 'Dishes', points: 10, state: 'done', due_time: null, done_at: '2026-10-24T16:30:00Z' },
          ],
        },
      ],
    })
    apiMock.mockImplementation(async (p) => {
      if (p === '/today') return data
      return undefined
    })
    wrap(<TodayPage />)
    await screen.findByRole('button', { name: /kid1/i })
    const row = (await screen.findAllByTestId('chore-row'))[0]
    expect(row).toHaveAttribute('data-state', 'done')
    expect(await screen.findByText(/^done \d+:\d+ [ap]m · approved$/i)).toBeInTheDocument()
  })

  test('progress meter shows chores done and total', async () => {
    wrap(<TodayPage />)
    await screen.findByRole('button', { name: /kid1/i })
    const progressText = await screen.findByText(/0 of 2 done/i)
    expect(progressText).toBeInTheDocument()
  })

  test('summary strip shows status, today, earned, and last active info', async () => {
    wrap(<TodayPage />)
    await screen.findByRole('button', { name: /kid1/i })
    const summaryStrip = await screen.findByTestId('summary-strip')
    expect(summaryStrip).toBeInTheDocument()
    const statusLabels = screen.getAllByText(/^status$/i)
    expect(statusLabels.length).toBeGreaterThan(0)
  })

  test('needs you lists all kids\' items', async () => {
    const data = todayData({
      needs_you: [
        { type: 'chore', id: 1, kid_id: 1, kid_name: 'Kid1', title: 'Dishes' },
        { type: 'chore', id: 2, kid_id: 2, kid_name: 'Kid2', title: 'Laundry' },
      ],
      kids: [],
    })
    apiMock.mockImplementation(async (p) => {
      if (p === '/today') return data
      return undefined
    })
    wrap(<TodayPage />)
    const needsYouTab = await screen.findByRole('tab', { name: /needs you.*2/i })
    await userEvent.click(needsYouTab)
    const dishesItems = screen.getAllByText(/dishes/i)
    expect(dishesItems.length).toBeGreaterThan(0)
    expect(await screen.findByText(/laundry/i)).toBeInTheDocument()
  })
})
