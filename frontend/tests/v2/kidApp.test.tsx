import { beforeEach, describe, expect, test } from '@jest/globals'
import type { Mock } from 'jest-mock'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MantineProvider } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useRouter } from 'next/router'
import { KidApp } from '@/v2/kid/KidApp'
import { KidPage } from '@/v2/kid/KidPage'
import { api } from '@/v2/api'
import { useUnifiedAuth } from '@/contexts/UnifiedAuthContext'
import { fridgeTheme } from '@/v2/theme'
import type { AgeGroup, KidToday } from '@/v2/types'

jest.mock('@/v2/api', () => ({ ...(jest.requireActual('@/v2/api') as object), api: jest.fn() }))
jest.mock('@mantine/notifications', () => ({ notifications: { show: jest.fn() } }))
jest.mock('@/contexts/UnifiedAuthContext', () => ({ useUnifiedAuth: jest.fn() }))
jest.mock('next/router', () => ({ useRouter: jest.fn() }))

const apiMock = api as unknown as Mock<(p: string, i?: { method?: string; asKid?: number; kid?: boolean }) => Promise<unknown>>
const routes: Record<string, unknown> = {}

let width = 1280
beforeEach(() => {
  width = 1280
  window.matchMedia = ((q: string) => {
    const min = /min-width:\s*(\d+)px/.exec(q)
    const max = /max-width:\s*(\d+)px/.exec(q)
    const matches = (!min || width >= Number(min[1])) && (!max || width <= Number(max[1]))
    return { matches, media: q, onchange: null, addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false }
  }) as unknown as typeof window.matchMedia
  for (const k of Object.keys(routes)) delete routes[k]
  apiMock.mockReset().mockImplementation(async (p, i) => routes[`${i?.method ?? 'GET'} ${p}`] ?? undefined)
  ;(notifications.show as unknown as Mock<() => void>).mockReset()
})

const today = (age: AgeGroup, over: Partial<KidToday> = {}): KidToday => ({
  locked: true,
  points_balance: 4,
  age_group: age,
  locks_at: null,
  timezone: 'UTC',
  chores: [
    { id: 7, title: 'Dishes', points: 5, state: 'todo' },
    { id: 8, title: 'Bed', points: 3, state: 'done' },
  ],
  ...over,
})

const client = () => new QueryClient({ defaultOptions: { queries: { retry: false } } })
function renderApp(d: KidToday, preview = false) {
  const done = { mutate: jest.fn(), isPending: false, variables: undefined }
  render(
    <QueryClientProvider client={client()}>
      <MantineProvider theme={fridgeTheme}>
        <KidApp d={d} name="Leo" avatar="🦁" kidId={3} preview={preview} onExit={() => {}} onLocker={() => {}} canSwitch={false} done={done} />
      </MantineProvider>
    </QueryClientProvider>,
  )
  return done
}

describe('KidApp', () => {
  test.each([
    ['little', 'Do this now'],
    ['kid', 'Internet is paused'],
    ['teen', 'done today'],
  ] as [AgeGroup, string][])('%s renders its mode', (age, text) => {
    renderApp(today(age))
    expect(screen.getByText(text)).toBeInTheDocument()
  })

  test('Little has no Chat or Alerts nav', () => {
    renderApp(today('little'))
    expect(screen.getByRole('button', { name: /Prizes/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Chat/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /^Alerts/ })).toBeNull()
    expect(apiMock.mock.calls.some(([p]) => p.startsWith('/notifications'))).toBe(false)
  })

  test('Little does not poll chat threads; Kid does', () => {
    const polled = () => apiMock.mock.calls.some(([p]) => p.startsWith('/chat'))
    renderApp(today('little'))
    expect(polled()).toBe(false)
    renderApp(today('kid'))
    expect(polled()).toBe(true)
  })

  test('at 1280px the rail renders and the app has no 520px max-width', async () => {
    renderApp(today('kid'))
    expect(await screen.findByRole('navigation', { name: 'Kid menu' })).toHaveAttribute('data-kind', 'rail')
    const app = document.querySelector('.k-app') as HTMLElement
    expect(app.style.maxWidth).toBe('')
    expect(screen.getByRole('button', { name: /Chores/ })).toHaveAttribute('aria-current', 'page')
  })

  test('at 390px the bottom bar renders', async () => {
    width = 390
    renderApp(today('teen'))
    expect(await screen.findByRole('navigation', { name: 'Kid menu' })).toHaveAttribute('data-kind', 'bar')
  })

  test('chores badge counts the to-do chores', () => {
    renderApp(today('kid'))
    const chores = screen.getByRole('button', { name: 'Chores 1' })
    // the count is CSS-drawn: visible text "Chores" stays inside the name (WCAG 2.5.3)
    expect(chores).toHaveTextContent(/^checklistChores$/)
    expect(chores.querySelector('.k-bd')).toHaveAttribute('data-n', '1')
  })

  test('Alerts tab lists inbox items and "Mark all read" posts', async () => {
    routes['GET /notifications'] = {
      items: [{ id: 1, kind: 'chore_approved', title: 'Dishes approved', body: '+5 points', created_at: new Date().toISOString(), read: false, run_id: null, redemption_id: null, device_id: null, thread_id: null, points: 5 }],
      unread: 1,
      has_more: false,
    }
    renderApp(today('kid'))
    await userEvent.click(await screen.findByRole('button', { name: 'Alerts 1' }))
    expect(screen.getByText('Dishes approved')).toBeInTheDocument()
    expect(screen.getByText('+5 points')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Mark all read' }))
    await waitFor(() => expect(apiMock).toHaveBeenCalledWith('/notifications/read-all', { method: 'POST', kid: true }))
  })

  test('tapping an alert reads it; a chore alert goes to Chores, a chat one opens the dock list', async () => {
    const item = (id: number, kind: string, run_id: number | null) => ({
      id, kind, title: `t${id}`, body: null, created_at: new Date().toISOString(), read: false, run_id, redemption_id: null, device_id: null, thread_id: null, points: null,
    })
    routes['GET /notifications'] = { items: [item(1, 'chore_new', 7), item(2, 'chat_message', null)], unread: 2, has_more: false }
    const list = jest.fn()
    window.addEventListener('task4ce:open-chat-list', list)
    renderApp(today('kid'))
    await userEvent.click(await screen.findByRole('button', { name: 'Alerts 2' }))
    await userEvent.click(screen.getByRole('button', { name: /t2/ }))
    expect(list).toHaveBeenCalled()
    await waitFor(() => expect(apiMock).toHaveBeenCalledWith('/notifications/2/read', { method: 'POST', kid: true }))
    await userEvent.click(screen.getByRole('button', { name: /t1/ }))
    expect(screen.getByRole('button', { name: /^Chores/ })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('heading', { level: 1, name: 'Dishes' })).toBeInTheDocument() // the alert's chore is open
    window.removeEventListener('task4ce:open-chat-list', list)
  })

  test('Alerts empty state', async () => {
    routes['GET /notifications'] = { items: [], unread: 0, has_more: false }
    renderApp(today('kid'))
    await userEvent.click(screen.getByRole('button', { name: 'Alerts' }))
    expect(await screen.findByText('Nothing new. Alerts about your chores show up here.')).toBeInTheDocument()
  })

  test('Rewards tab says Prizes in Little', async () => {
    routes['GET /kid/rewards'] = { balance: 4, rewards: [], pending: [], screen_time_enabled: false, screen_time_price: 1, screen: { enabled: false, price: 1, auto: false, only_in_hours: false, max_today: null, bought_today: 0, left_today: null, min_points: null, in_hours: true } }
    renderApp(today('little'))
    await userEvent.click(screen.getByRole('button', { name: 'Prizes' }))
    expect(await screen.findByRole('heading', { name: /^Prizes · 4 points/ })).toBeInTheDocument()
  })
})

describe('preview', () => {
  beforeEach(() => {
    routes['GET /kid/today'] = today('kid', { chores: [{ id: 7, title: 'Dishes', points: 5, state: 'todo' }] })
    routes['GET /kids'] = [{ id: 3, full_name: 'Leo', username: 'leo', avatar: '🦁', has_pin: false }]
    routes['GET /leaderboard'] = { rows: [] }
    ;(useRouter as unknown as Mock<() => unknown>).mockReturnValue({ query: { as: '3' }, push: jest.fn() })
    ;(useUnifiedAuth as unknown as Mock<() => unknown>).mockReturnValue({ user: { role: 'parent' }, isLoading: false })
  })
  const renderPage = () =>
    render(
      <QueryClientProvider client={client()}>
        <MantineProvider theme={fridgeTheme}>
          <KidPage />
        </MantineProvider>
      </QueryClientProvider>,
    )

  test("I'm done! toasts the preview message, never calls /seen, and shows the bar", async () => {
    renderPage()
    expect(await screen.findByText('Viewing as Leo · preview')).toBeInTheDocument()
    await userEvent.click(await screen.findByRole('button', { name: /^Open Dishes/ }))
    await userEvent.click(screen.getByRole('button', { name: /I'm done!/ }))
    await waitFor(() =>
      expect(notifications.show).toHaveBeenCalledWith(expect.objectContaining({ message: 'Preview only. Log in as Leo to do this.' })),
    )
    expect(apiMock.mock.calls.some(([p]) => p.includes('/seen'))).toBe(false)
    expect(apiMock.mock.calls.some(([p]) => p.startsWith('/notifications') || p.startsWith('/chat'))).toBe(false)
  })

  test('Chat and Alerts tabs say they show on the kid screen', async () => {
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: 'Alerts' }))
    expect(screen.getByText("Alerts and chat show on Leo's own screen.")).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Chat' }))
    expect(screen.getByText("Alerts and chat show on Leo's own screen.")).toBeInTheDocument()
  })
})
