import { beforeEach, describe, expect, test } from '@jest/globals'
import type { Mock } from 'jest-mock'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MantineProvider } from '@mantine/core'
import { RewardsSection } from '@/v2/kid/RewardsSection'
import { BadgeGrid } from '@/v2/components/BadgeGrid'
import { notifications } from '@mantine/notifications'
import { AwardOverlay } from '@/v2/kid/AwardOverlay'
import { api } from '@/v2/api'
import { fridgeTheme } from '@/v2/theme'

jest.mock('@/v2/api', () => ({
  ...(jest.requireActual('@/v2/api') as object),
  api: jest.fn(),
}))
jest.mock('@mantine/notifications', () => ({ notifications: { show: jest.fn() } }))

const apiMock = api as unknown as Mock<(p: string, i?: { method?: string; body?: unknown; kid?: boolean }) => Promise<unknown>>

const rewards = (over: object = {}) => ({
  balance: 120,
  screen_time_price: 20,
  screen_time_enabled: true,
  screen: { enabled: true, price: 20, auto: false, only_in_hours: false, max_today: null, bought_today: 0, left_today: null, min_points: null, in_hours: true },
  rewards: [],
  pending: [],
  ...over,
})
const route = (r: Record<string, unknown>) =>
  apiMock.mockImplementation(async (p, i) => {
    const k = `${i?.method ?? 'GET'} ${p}`
    if (!(k in r)) throw new Error(`unrouted ${k}`)
    return r[k]
  })
const calls = (p: string) => apiMock.mock.calls.filter((c) => c[0] === p)

const wrap = (ui: React.ReactNode) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MantineProvider theme={fridgeTheme}>{ui}</MantineProvider>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  apiMock.mockReset()
  window.matchMedia =
    window.matchMedia ||
    ((() => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} })) as never)
})

describe('RewardsSection', () => {
  test('unaffordable reward shows progress and disabled Request', async () => {
    route({ 'GET /kid/rewards': rewards({ screen_time_enabled: false, rewards: [{ id: 1, name: 'Movie', price: 300, icon: '🎬' }] }) })
    wrap(<RewardsSection onExpired={() => {}} />)
    const bar = await screen.findByRole('progressbar')
    expect(bar).toHaveAttribute('aria-valuenow', '40')
    expect(screen.getByRole('button', { name: 'Request' })).toBeDisabled()
  })

  test('affordable reward posts redeem', async () => {
    route({
      'GET /kid/rewards': rewards({ screen_time_enabled: false, rewards: [{ id: 2, name: 'Ice cream', price: 100, icon: null }] }),
      'POST /kid/redeem': {},
    })
    wrap(<RewardsSection onExpired={() => {}} />)
    await userEvent.click(await screen.findByRole('button', { name: 'Request' }))
    expect(calls('/kid/redeem')[0][1]).toMatchObject({ method: 'POST', body: { kind: 'reward', reward_id: 2 }, kid: true })
  })

  test('pending reward shows waiting text', async () => {
    route({
      'GET /kid/rewards': rewards({
        screen_time_enabled: false,
        rewards: [{ id: 2, name: 'Ice cream', price: 100, icon: null }],
        pending: [{ id: 9, kind: 'reward', reward_id: 2, minutes: null, cost: 100 }],
      }),
    })
    wrap(<RewardsSection onExpired={() => {}} />)
    expect(await screen.findByText('Waiting for a parent')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Request' })).toBeNull()
  })

  test('screen time shows cost and posts minutes', async () => {
    route({ 'GET /kid/rewards': rewards(), 'POST /kid/redeem': {} })
    wrap(<RewardsSection onExpired={() => {}} />)
    expect(await screen.findByText('40')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Request screen time' }))
    expect(calls('/kid/redeem')[0][1]).toMatchObject({ body: { kind: 'screen_time', minutes: 30 } })
  })

  test('screen time hidden when disabled', async () => {
    route({ 'GET /kid/rewards': rewards({ screen_time_enabled: false }) })
    wrap(<RewardsSection onExpired={() => {}} />)
    await screen.findByText(/Rewards/)
    expect(screen.queryByText('Screen time')).toBeNull()
  })
})

const scr = (o: object) => ({ enabled: true, price: 20, auto: false, only_in_hours: false, max_today: null, bought_today: 0, left_today: null, min_points: null, in_hours: true, ...o })
const rw = (o: object = {}) => ({ id: 3, name: 'Movie night', price: 50, icon: 'movie', needs_approval: true, ...o })

describe('Plan E rewards', () => {
  test('reward glyph renders as an icon', async () => {
    route({ 'GET /kid/rewards': rewards({ screen_time_enabled: false, rewards: [rw()] }) })
    const { container } = wrap(<RewardsSection onExpired={() => {}} />)
    await screen.findByText(/Movie night/)
    expect(container.querySelector('[data-icon="movie"]')).toHaveAttribute('aria-hidden', 'true')
  })

  test('Get it on instant reward shows It\'s yours', async () => {
    route({
      'GET /kid/rewards': rewards({ screen_time_enabled: false, rewards: [rw({ needs_approval: false, icon: null })] }),
      'POST /kid/redeem': { status: 'approved' },
    })
    const { container } = wrap(<RewardsSection onExpired={() => {}} />)
    await userEvent.click(await screen.findByRole('button', { name: 'Get it' }))
    expect(await screen.findByText("It's yours!")).toBeInTheDocument()
    expect(container.querySelector('[data-icon="redeem"]')).toBeTruthy()
  })

  test('left_today caps minute options', async () => {
    route({ 'GET /kid/rewards': rewards({ screen: scr({ left_today: 15, max_today: 60, bought_today: 45 }) }) })
    wrap(<RewardsSection onExpired={() => {}} />)
    await screen.findByText('45 of 60 min today')
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['15 minutes'])
  })

  test('left_today 0 disables with server wording', async () => {
    route({ 'GET /kid/rewards': rewards({ screen: scr({ left_today: 0, max_today: 60, bought_today: 60 }) }) })
    wrap(<RewardsSection onExpired={() => {}} />)
    expect(await screen.findByText("You've had all your screen time for today.")).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Request screen time' })).toBeDisabled()
  })

  test('min_points and hours reasons', async () => {
    route({ 'GET /kid/rewards': rewards({ balance: 10, screen: scr({ min_points: 50, only_in_hours: true, in_hours: false }) }) })
    wrap(<RewardsSection onExpired={() => {}} />)
    expect(await screen.findByText('You can buy screen time once you have 50 points.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Request screen time' })).toBeDisabled()
  })

  test('left_today under 15 offers no odd option', async () => {
    route({ 'GET /kid/rewards': rewards({ screen: scr({ left_today: 10, max_today: 60, bought_today: 50 }) }) })
    wrap(<RewardsSection onExpired={() => {}} />)
    expect(await screen.findByText("You've had all your screen time for today.")).toBeInTheDocument()
    expect(screen.queryAllByRole('option')).toHaveLength(0)
    expect(screen.getByRole('button', { name: 'Request screen time' })).toBeDisabled()
  })

  test('outside allowed hours reason', async () => {
    route({ 'GET /kid/rewards': rewards({ screen: scr({ only_in_hours: true, in_hours: false }) }) })
    wrap(<RewardsSection onExpired={() => {}} />)
    expect(await screen.findByText('Screen time only works during your allowed hours.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Request screen time' })).toBeDisabled()
  })

  test('off-window reason when bought minutes would not work (bedtime)', async () => {
    route({ 'GET /kid/rewards': rewards({ screen: scr({ only_in_hours: false, off_now: true }) }) })
    wrap(<RewardsSection onExpired={() => {}} />)
    expect(await screen.findByText("Screen time can't turn the internet on during off hours.")).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Request screen time' })).toBeDisabled()
  })

  test('auto screen time says Get screen time', async () => {
    route({ 'GET /kid/rewards': rewards({ screen: scr({ auto: true }) }) })
    wrap(<RewardsSection onExpired={() => {}} />)
    expect(await screen.findByRole('button', { name: 'Get screen time' })).toBeEnabled()
  })

  test('409 detail is shown', async () => {
    const { ApiError } = jest.requireActual('@/v2/api') as { ApiError: new (s: number, d: string) => Error }
    route({ 'GET /kid/rewards': rewards() })
    apiMock.mockImplementation(async (p, i) => {
      if (i?.method === 'POST') throw new ApiError(409, 'You can have 15 more minutes today.')
      return rewards()
    })
    wrap(<RewardsSection onExpired={() => {}} />)
    await userEvent.click(await screen.findByRole('button', { name: 'Request screen time' }))
    await screen.findByRole('button', { name: 'Request screen time' })
    expect(notifications.show).toHaveBeenCalledWith(expect.objectContaining({ message: 'You can have 15 more minutes today.' }))
  })

  test('badge grid: custom glyph, built-in emoji', () => {
    const b = (o: object) => ({ key: 'k', name: 'N', icon: '🏅', description: '', tier: 1, tier_name: 'Copper', custom: false, ...o })
    const { container } = wrap(<BadgeGrid badges={[b({ key: 'a', icon: 'star', custom: true }), b({ key: 'b', icon: '🌟' })]} />)
    expect(container.querySelector('[data-icon="star"]')).toBeTruthy()
    expect(container).toHaveTextContent('🌟')
  })

  test('overlay shows glyph', async () => {
    route({ 'GET /kid/celebrations': [{ key: 'b:2', kind: 'badge', title: 'Helper', detail: 'copper', size: 'small', glyph: 'volunteer_activism' }] })
    wrap(<AwardOverlay onExpired={() => {}} />)
    const d = await screen.findByRole('dialog')
    expect(d.querySelector('[data-icon="volunteer_activism"]')).toBeTruthy()
  })
})

describe('AwardOverlay', () => {
  const reward = { key: 'r:5', kind: 'reward', title: 'Ice cream', detail: '100 points', size: 'big' }
  const level = { key: 'l:8', kind: 'level', title: 'Level 8 · Clutch', detail: 'New flair: Crown, Rocket', size: 'big', unlocked: [{ id: 'emblem-crown', label: 'Crown', emblem: '👑' }, { id: 'emblem-rocket', label: 'Rocket', emblem: '🚀' }] }
  const badge = { key: 'b:2', kind: 'badge', title: '🏅 Task Master', detail: 'copper', size: 'small' }

  test('shows reward and marks seen', async () => {
    route({ 'GET /kid/celebrations': [reward], 'POST /kid/celebrations/r%3A5/seen': {} })
    wrap(<AwardOverlay onExpired={() => {}} />)
    expect(await screen.findByRole('dialog')).toHaveTextContent('Ice cream')
    await userEvent.click(screen.getByRole('button', { name: 'Nice!' }))
    expect(calls('/kid/celebrations/r%3A5/seen')).toHaveLength(1)
  })

  test('level celebration shows new title and url-encodes key', async () => {
    route({ 'GET /kid/celebrations': [level], 'POST /kid/celebrations/l%3A8/seen': {} })
    wrap(<AwardOverlay onExpired={() => {}} />)
    expect(await screen.findByRole('dialog')).toHaveTextContent('Level 8 · Clutch')
    await userEvent.click(screen.getByRole('button', { name: 'Nice!' }))
    expect(calls('/kid/celebrations/l%3A8/seen')).toHaveLength(1)
  })

  test('level celebration shows unlocked flair chips and Go to Locker opens the Locker', async () => {
    const onLocker = jest.fn()
    route({ 'GET /kid/celebrations': [level], 'POST /kid/celebrations/l%3A8/seen': {} })
    wrap(<AwardOverlay onExpired={() => {}} onLocker={onLocker} />)
    const d = await screen.findByRole('dialog')
    expect(d).toHaveTextContent('👑 Crown')
    expect(d).toHaveTextContent('🚀 Rocket')
    await userEvent.click(screen.getByRole('button', { name: 'Go to Locker' }))
    expect(onLocker).toHaveBeenCalled()
    expect(calls('/kid/celebrations/l%3A8/seen')).toHaveLength(1)
  })

  test('small badge celebration shows tier', async () => {
    route({ 'GET /kid/celebrations': [badge] })
    wrap(<AwardOverlay onExpired={() => {}} />)
    const d = await screen.findByRole('dialog')
    expect(d).toHaveTextContent('Task Master')
    expect(d).toHaveTextContent('copper')
    expect(d).toHaveClass('award-toast')
  })

  test('renders with reduced motion', async () => {
    window.matchMedia = ((q: string) => ({ matches: q.includes('reduce'), addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} })) as never
    route({ 'GET /kid/celebrations': [reward] })
    wrap(<AwardOverlay onExpired={() => {}} />)
    expect(await screen.findByRole('dialog')).toHaveTextContent('Ice cream')
  })
})
