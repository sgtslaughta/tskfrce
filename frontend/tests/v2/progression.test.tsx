import { beforeEach, describe, expect, test } from '@jest/globals'
import type { Mock } from 'jest-mock'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MantineProvider } from '@mantine/core'
import { KidPage } from '@/v2/kid/KidPage'
import { Leaderboard } from '@/v2/components/Leaderboard'
import { ProfileModal } from '@/v2/components/ProfileModal'
import { ProgressHeader } from '@/v2/components/ProgressHeader'
import { api } from '@/v2/api'
import { fridgeTheme } from '@/v2/theme'
import type { Badge, Profile } from '@/v2/types'

jest.mock('@/v2/api', () => ({ ...(jest.requireActual('@/v2/api') as object), api: jest.fn() }))
jest.mock('@mantine/notifications', () => ({ notifications: { show: jest.fn() } }))
const apiMock = api as unknown as Mock<(p: string, i?: unknown) => Promise<unknown>>

const badge = (name: string, tier_name: string, tier: number): Badge => ({
  key: name, name, icon: '🔥', description: '', tier, tier_name, custom: false,
})
const ben: Profile = {
  kid_id: 2, name: 'Ben', avatar: '🐼', level: 3, title: 'Regular', streak: 4,
  badges: [badge('On Fire', 'Gold', 3)],
}

function wrap(ui: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MantineProvider theme={fridgeTheme}>{ui}</MantineProvider>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  localStorage.clear()
  apiMock.mockReset()
  window.matchMedia =
    window.matchMedia ||
    ((() => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} })) as never)
})

describe('ProgressHeader', () => {
  test('shows level tag, XP percent and streak', () => {
    wrap(<ProgressHeader name="Ana" progress={{ level: 8, title: 'Clutch', xp: 1200, floor: 1000, next: 1400, streak: 12 }} />)
    expect(screen.getByText('Lv 8 · Clutch')).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '50')
    expect(screen.getByText('12 day streak')).toBeInTheDocument()
  })
})

describe('Leaderboard', () => {
  test('rows in rank order, ties marked', () => {
    const row = (kid_id: number, name: string, score: number, rank: number) => ({
      kid_id, name, avatar: null, score, level: 1, title: 'Rookie', rank,
    })
    wrap(<Leaderboard rows={[row(1, 'Amy', 20, 1), row(2, 'Ben', 20, 1), row(3, 'Cal', 0, 3)]} />)
    const items = screen.getAllByRole('listitem')
    expect(items.map((li) => li.textContent)).toEqual([
      expect.stringContaining('Amy'),
      expect.stringContaining('Ben'),
      expect.stringContaining('Cal'),
    ])
    expect(screen.getAllByText('T1')).toHaveLength(2)
    expect(screen.getByText('3')).toBeInTheDocument()
  })
})

const gold = { card: 'card-sheen', ring: null, name: null, emblem: 'emblem-crown', title: null }

describe('flair on identity surfaces', () => {
  beforeEach(() => {
    apiMock.mockImplementation(async (p) => (p === '/flair/emblems' ? { 'emblem-crown': '👑' } : ben))
  })

  test('progress header renders the equipped card and emblem', async () => {
    const { container } = wrap(
      <ProgressHeader name="Ana" progress={{ level: 8, title: 'Clutch', xp: 1200, floor: 1000, next: 1400, streak: 1, flair: gold }} />,
    )
    expect(container.querySelector('.flair-card.flair-card-sheen')).toBeTruthy()
    expect(await screen.findByText('👑')).toBeInTheDocument()
  })

  test('leaderboard row renders the equipped card', () => {
    const row = { kid_id: 1, name: 'Amy', avatar: null, score: 5, level: 8, title: 'Clutch', rank: 1, flair: gold }
    const { container } = wrap(<Leaderboard rows={[row]} />)
    expect(container.querySelector('.flair-card.flair-card-sheen.flair-card-sm')).toBeTruthy()
  })

  test('profile modal renders the equipped card', async () => {
    apiMock.mockImplementation(async (p) => (p === '/flair/emblems' ? {} : { ...ben, flair: gold }))
    wrap(<ProfileModal kidId={2} onClose={() => {}} />)
    await screen.findByText('On Fire')
    expect(document.querySelector('.flair-card.flair-card-sheen.flair-card-lg')).toBeTruthy()
  })
})

describe('ProfileModal', () => {
  test('lists badges with tier names', async () => {
    apiMock.mockResolvedValue(ben)
    wrap(<ProfileModal kidId={2} onClose={() => {}} />)
    expect(await screen.findByText('On Fire')).toBeInTheDocument()
    expect(screen.getByText('Gold')).toBeInTheDocument()
  })
})

describe('kid page family', () => {
  test('shows siblings and opens a profile', async () => {
    const ana = { id: 1, full_name: 'Ana', avatar: '🦊', has_pin: false }
    apiMock.mockImplementation(async (p) => {
      if (p === '/kid/whoami') return { device: { id: 1, name: 'iPad' }, kids: [ana] }
      if (p === '/kid/login') return { access_token: 't' }
      if (p === '/kid/today')
        return {
          locked: false, points_balance: 3, chores: [],
          progress: { level: 2, title: 'Rookie', xp: 60, floor: 50, next: 113, streak: 1 },
        }
      if (p === '/leaderboard') return { week_start: '2026-10-19', rows: [] }
      if (p === '/profiles') return [{ ...ben, kid_id: 1, name: 'Ana' }, ben]
      if (p === '/profiles/2') return ben
      return []
    })
    wrap(<KidPage />)
    await userEvent.click(await screen.findByRole('button', { name: 'Me' }))
    expect(await screen.findByText('Lv 2 · Rookie')).toBeInTheDocument()
    await userEvent.click(await screen.findByRole('button', { name: /^Ben/ }))
    await waitFor(() => expect(screen.getByText('On Fire')).toBeInTheDocument())
    expect(screen.queryByRole('button', { name: /^Ana/ })).toBeNull()
  })
})
