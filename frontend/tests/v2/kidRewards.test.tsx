import { beforeEach, describe, expect, test } from '@jest/globals'
import type { Mock } from 'jest-mock'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MantineProvider } from '@mantine/core'
import { RewardsSection } from '@/v2/kid/RewardsSection'
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

describe('AwardOverlay', () => {
  const award = { id: 5, kind: 'reward', name: 'Ice cream', minutes: null, cost: 100 }

  test('shows reward and marks seen', async () => {
    route({ 'GET /kid/awards': [award], 'POST /kid/awards/5/seen': {} })
    wrap(<AwardOverlay onExpired={() => {}} />)
    expect(await screen.findByRole('dialog')).toHaveTextContent('Ice cream')
    await userEvent.click(screen.getByRole('button', { name: 'Nice!' }))
    expect(calls('/kid/awards/5/seen')).toHaveLength(1)
  })

  test('renders with reduced motion', async () => {
    window.matchMedia = ((q: string) => ({ matches: q.includes('reduce'), addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} })) as never
    route({ 'GET /kid/awards': [award] })
    wrap(<AwardOverlay onExpired={() => {}} />)
    expect(await screen.findByRole('dialog')).toHaveTextContent('Ice cream')
  })
})
