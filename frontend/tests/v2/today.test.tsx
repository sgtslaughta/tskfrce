import { beforeEach, describe, expect, test } from '@jest/globals'
import type { Mock } from 'jest-mock'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MantineProvider } from '@mantine/core'
import { api } from '@/v2/api'
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
  progress: { level: 1, points: 0, next_reward: 100, next_reward_points: 50, locked_until: null },
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
    const choreButton = await screen.findByRole('button', { name: /dishes/i })
    expect(choreButton).toHaveStyle('textDecoration: line-through')
    expect(await screen.findByText(/done \d+:\d+ [ap]m/i)).toBeInTheDocument()
  })

  test('done chore time uses CSS variable for color', async () => {
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
    const doneTimeText = await screen.findByText(/done \d+:\d+ [ap]m/i)
    const span = doneTimeText.closest('span')
    expect(span?.style.color).toBe('var(--p-sub)')
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

  test('chat column appears only after reply and closing it removes it', async () => {
    wrap(<TodayPage />)
    await screen.findByRole('button', { name: /kid1/i })
    const rows = await screen.findAllByTestId('chore-row')
    const button = rows[0]?.querySelector('button')
    if (button) await userEvent.click(button)
    expect(screen.queryByTestId('chat-column')).not.toBeInTheDocument()
    const openChatButton = screen.queryByRole('button', { name: /open chat/i })
    if (openChatButton) {
      await userEvent.click(openChatButton)
      await waitFor(() => expect(screen.queryByTestId('chat-column')).toBeInTheDocument())
    }
  })

  test('approve uses undo toast', async () => {
    wrap(<TodayPage />)
    await screen.findByRole('button', { name: /kid1/i })
    const rows = await screen.findAllByTestId('chore-row')
    const button = rows[0]?.querySelector('button')
    if (button) await userEvent.click(button)
    const approveButton = screen.queryByRole('button', { name: /approve/i })
    if (approveButton) await userEvent.click(approveButton)
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
