import { describe, expect, test } from '@jest/globals'
import type { ReactNode } from 'react'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { notifications } from '@mantine/notifications'
import { KidsPage } from '@/v2/manage/KidsPage'
import { apiMock, calls, detail, list, mockRoute, serve, setupLibrary, wrap } from './libraryHelpers'

jest.mock('@mantine/notifications', () => ({ notifications: { show: jest.fn(), hide: jest.fn() } }))
jest.mock('next/router', () => ({
  useRouter: () => ({ query: mockRoute.query, push: mockRoute.push, replace: mockRoute.replace, pathname: '/kids' }),
}))
jest.mock('@/v2/api', () => ({ api: jest.fn() }))
const mockDownload = jest.fn()
jest.mock('@/v2/manage/historyCsv', () => ({
  ...jest.requireActual<object>('@/v2/manage/historyCsv'),
  downloadCsv: (...a: unknown[]) => mockDownload(...a),
}))
jest.mock('@/v2/parent/ParentShell', () => ({
  ParentShell: ({ list, children }: { list: ReactNode; children: ReactNode }) => (
    <>
      <div data-testid="list">{list}</div>
      <div data-testid="detail">{children}</div>
    </>
  ),
}))
jest.mock('@/v2/components/RequireParent', () => ({
  RequireParent: ({ children }: { children: ReactNode }) => <>{children}</>,
  startSignOut: jest.fn(),
  cancelSignOut: jest.fn(),
}))

setupLibrary()

const pending = [
  { id: 41, kid_id: 7, kid_name: 'Maya', kind: 'reward', name: 'Movie night', icon: 'movie', minutes: null, cost: 100, created_at: '2026-10-25T17:51:00Z', kid_balance: 300, kid_balance_after: 200 },
  { id: 42, kid_id: 8, kid_name: 'Leo', kind: 'reward', name: 'Ice cream trip', icon: 'icecream', minutes: null, cost: 150, created_at: '2026-10-25T18:10:00Z', kid_balance: 95, kid_balance_after: -55 },
]
const rewards = [
  { id: 3, name: 'Movie night', price: 150, icon: 'movie', visible: true, needs_approval: true },
  { id: 4, name: 'Birthday pick', price: 500, icon: 'cake', visible: false, needs_approval: true },
]
const screenTime = {
  enabled: true,
  price: 20,
  kids: [
    { kid_id: 7, name: 'Maya', balance: 300, bought_today: 0, max_minutes: null, limit: null },
    { kid_id: 8, name: 'Leo', balance: 95, bought_today: 0, max_minutes: null, limit: null },
  ],
}
const data = (over: Record<string, unknown> = {}) =>
  serve({ '/redemptions': pending, '/rewards': rewards, '/screen-time': screenTime, ...over })

const leoCard = async () => (await within(detail()).findByText('Ice cream trip')).closest('article') as HTMLElement

describe('rewards: requests', () => {
  test('a short request shows the negative balance, Not enough points and a disabled Approve', async () => {
    data()
    mockRoute.query = { section: 'rewards', item: 'requests' }
    render(wrap(<KidsPage />))
    const card = await leoCard()
    expect(card).toHaveTextContent('95 → -55')
    expect(card).toHaveTextContent('Not enough points')
    expect(within(card).getByRole('button', { name: 'Approve' })).toBeDisabled()
    expect(within(card).getByRole('button', { name: 'Decline' })).toBeEnabled()
  })

  test('Decline sends the note to /deny', async () => {
    data()
    mockRoute.query = { section: 'rewards', item: 'requests' }
    render(wrap(<KidsPage />))
    const card = await leoCard()
    await userEvent.type(within(card).getByPlaceholderText('Add a note (optional)…'), 'Save up first')
    await userEvent.click(within(card).getByRole('button', { name: 'Decline' }))
    await waitFor(() =>
      expect(calls('POST')[0]).toEqual(['/redemptions/42/deny', { method: 'POST', body: { note: 'Save up first' } }]),
    )
  })

  test('Approve all posts /approve-all and reports skipped requests', async () => {
    data({ '/redemptions/approve-all': { approved: 1, skipped: 1 } })
    mockRoute.query = { section: 'rewards', item: 'requests' }
    render(wrap(<KidsPage />))
    await userEvent.click(await within(detail()).findByRole('button', { name: 'Approve all' }))
    await waitFor(() => expect(calls('POST')[0]).toEqual(['/redemptions/approve-all', { method: 'POST' }]))
    await waitFor(() =>
      expect(notifications.show).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Approved 1, 1 skipped (not enough points)' }),
      ),
    )
  })

  test('nav shows the waiting count; no requests shows the empty state', async () => {
    data({ '/redemptions': [] })
    mockRoute.query = { section: 'rewards', item: 'requests' }
    render(wrap(<KidsPage />))
    expect(await within(detail()).findByText('No requests')).toBeInTheDocument()
    expect(within(list()).getByRole('button', { name: /Requests/ })).toHaveTextContent('Nothing waiting')
    await waitFor(() => expect(within(list()).getByRole('button', { name: /Catalogue/ })).toHaveTextContent('2 rewards · 1 hidden'))
  })

  test('while requests are loading nothing claims 0 waiting', async () => {
    data({ '/redemptions': new Promise(() => {}) })
    mockRoute.query = { section: 'rewards', item: 'requests' }
    render(wrap(<KidsPage />))
    await waitFor(() => expect(within(list()).getByRole('button', { name: /Catalogue/ })).toHaveTextContent('2 rewards'))
    expect(within(list()).getByRole('button', { name: /Requests/ })).not.toHaveTextContent(/waiting/i)
    expect(within(detail()).queryByText(/waiting/)).not.toBeInTheDocument()
  })
})

test('a screen-time request card names the device', async () => {
  data({ '/redemptions': [{ ...pending[0], id: 61, kind: 'screen_time', name: '30 min of screen time', icon: null, minutes: 30, device_name: 'Kitchen tablet' }] })
  mockRoute.query = { section: 'rewards', item: 'requests' }
  render(wrap(<KidsPage />))
  expect(await within(detail()).findByText(/from Kitchen tablet/)).toBeInTheDocument()
})

test('request cards use the icon sent with the request, not a name match', async () => {
  data({
    '/redemptions': [
      { ...pending[0], id: 51, name: 'Treat', icon: 'cake' },
      { ...pending[0], id: 52, kind: 'screen_time', name: '30 min of screen time', icon: null, minutes: 30 },
      { ...pending[0], id: 53, name: 'Gone', icon: null },
    ],
    '/rewards': [{ id: 9, name: 'Treat', price: 10, icon: 'movie', visible: true, needs_approval: true }],
  })
  mockRoute.query = { section: 'rewards', item: 'requests' }
  render(wrap(<KidsPage />))
  const glyph = async (name: string) =>
    ((await within(detail()).findByText(name)).closest('article') as HTMLElement).querySelector('.rw-glyph')?.textContent
  expect(await glyph('Treat')).toBe('cake')
  expect(await glyph('30 min of screen time')).toBe('timer')
  expect(await glyph('Gone')).toBe('redeem')
})

describe('rewards: catalogue', () => {
  test('hidden rewards get a Hidden chip; dots say who can afford it', async () => {
    data()
    mockRoute.query = { section: 'rewards', item: 'catalogue' }
    render(wrap(<KidsPage />))
    const card = (await within(detail()).findByRole('button', { name: /Birthday pick/ })) as HTMLElement
    expect(card).toHaveTextContent('Hidden')
    const movie = within(detail()).getByRole('button', { name: /Movie night/ })
    expect(await within(movie).findByLabelText('Maya can afford it')).toBeInTheDocument()
    expect(within(movie).getByLabelText("Leo can't afford it yet")).toBeInTheDocument()
  })

  test('with nothing picked the first reward opens in the editor', async () => {
    data()
    mockRoute.query = { section: 'rewards', item: 'catalogue' }
    render(wrap(<KidsPage />))
    expect(await within(detail()).findByRole('button', { name: 'Save reward' })).toBeInTheDocument()
    expect(within(detail()).getAllByRole('button', { name: /pts/ })[0]).toHaveAttribute('data-selected', 'true')
  })

  test('turning Needs approval off saves needs_approval:false', async () => {
    data()
    mockRoute.query = { section: 'rewards', item: 'catalogue', pick: '3' }
    render(wrap(<KidsPage />))
    const sw = await within(detail()).findByRole('switch', { name: 'Needs approval' })
    await userEvent.click(sw)
    expect(within(detail()).getByText('Points come off right away and you get a ping.')).toBeInTheDocument()
    await userEvent.click(within(detail()).getByRole('button', { name: 'Save reward' }))
    await waitFor(() =>
      expect(calls('PATCH')[0]).toEqual([
        '/rewards/3',
        { method: 'PATCH', body: { name: 'Movie night', price: 150, needs_approval: false } },
      ]),
    )
  })

  test('picking the movie glyph sends icon movie', async () => {
    data()
    mockRoute.query = { section: 'rewards', item: 'catalogue', pick: 'new' }
    render(wrap(<KidsPage />))
    await userEvent.type(await within(detail()).findByLabelText('Reward'), 'Film')
    await userEvent.click(within(detail()).getByTitle('movie'))
    await userEvent.click(within(detail()).getByRole('button', { name: 'Add reward' }))
    await waitFor(() =>
      expect(calls('POST')[0]).toEqual(['/rewards', { method: 'POST', body: { name: 'Film', price: 50, icon: 'movie' } }]),
    )
  })
})

const sam = { kid_id: 9, name: 'Sam', balance: 95, bought_today: 0, max_minutes: null, limit: null }
const stFull = {
  enabled: true,
  price: 20,
  max_minutes_per_day: 60,
  auto_approve: false,
  only_in_allowed_hours: true,
  reset_time: '04:00',
  avg_chore_points: 20,
  kids: [
    { kid_id: 7, name: 'Maya', balance: 860, bought_today: 30, max_minutes: 60, limit: null },
    { kid_id: 8, name: 'Leo', balance: 310, bought_today: 15, max_minutes: 30, limit: { max_minutes: 30, min_points: null } },
    sam,
  ],
}

describe('rewards: screen time', () => {
  test('Approve automatically + Save PATCHes only auto_approve', async () => {
    data({ '/screen-time': stFull })
    mockRoute.query = { section: 'rewards', item: 'screen' }
    render(wrap(<KidsPage />))
    const sw = await within(detail()).findByRole('switch', { name: 'Approve automatically' })
    const save = within(detail()).getByRole('button', { name: 'Save' })
    expect(save).toBeDisabled()
    await userEvent.click(sw)
    await userEvent.click(save)
    await waitFor(() => expect(calls('PATCH')[0]).toEqual(['/screen-time', { method: 'PATCH', body: { auto_approve: true } }]))
  })

  test('header chips, what points buy, bought today and per-kid limits', async () => {
    data({ '/screen-time': stFull })
    mockRoute.query = { section: 'rewards', item: 'screen' }
    render(wrap(<KidsPage />))
    const pane = detail()
    expect(await within(pane).findByText('20 pts = 15 min')).toBeInTheDocument()
    expect(within(pane).getByText('Max 60 min/day')).toBeInTheDocument()
    expect(within(pane).getByText('Average chore (20 pts)')).toBeInTheDocument()
    expect(within(pane).getByText('Maya · 860 pts').parentElement).toHaveTextContent('up to 10h 45m')
    expect(within(pane).getByText('Sam · 95 pts').parentElement).toHaveTextContent('up to 1h')
    const bought = within(pane).getByRole('region', { name: 'Bought today' })
    expect(bought).toHaveTextContent('resets 4:00 AM')
    expect(bought).toHaveTextContent('30 / 60 min')
    const limits = within(pane).getByRole('region', { name: 'Per-kid limits' })
    expect(limits).toHaveTextContent('Max 30 min/day')
  })

  test('Add a limit for Sam with a minimum of 100 PUTs the limit and lists it', async () => {
    let cur = stFull
    const saved = { ...stFull, kids: [stFull.kids[0], stFull.kids[1], { ...sam, limit: { max_minutes: null, min_points: 100 } }] }
    // getters (not data(): spreading would read them once)
    serve({
      '/redemptions': pending,
      get '/screen-time'() {
        return cur
      },
      get '/screen-time/limits/9'() {
        cur = saved
        return saved
      },
    })
    mockRoute.query = { section: 'rewards', item: 'screen' }
    render(wrap(<KidsPage />))
    await userEvent.click(await within(detail()).findByRole('button', { name: 'Add a limit' }))
    const limits = within(detail()).getByRole('region', { name: 'Per-kid limits' })
    await userEvent.selectOptions(within(limits).getByLabelText('Kid'), 'Sam')
    await userEvent.type(within(limits).getByLabelText('Minimum points'), '100')
    await userEvent.click(within(limits).getByRole('button', { name: 'Save limit' }))
    await waitFor(() =>
      expect(calls('PUT')[0]).toEqual(['/screen-time/limits/9', { method: 'PUT', body: { max_minutes: null, min_points: 100 } }]),
    )
    expect(await within(limits).findByText('Not allowed until 100 pts')).toBeInTheDocument()
  })
})

const hist = {
  totals: { spent: 2140, screen_minutes: 375, approved: 18, declined: 3 },
  rows: [
    { id: 1, kid_id: 7, kid_name: 'Maya', kind: 'screen_time', name: '15 min screen time', minutes: 15, cost: 20, status: 'approved', auto: true, decided_by_name: null, note: null, created_at: '2026-10-25T17:12:00Z', decided_at: '2026-10-25T17:12:00Z' },
    { id: 2, kid_id: 8, kid_name: 'Leo', kind: 'reward', name: 'New game', minutes: null, cost: 300, status: 'denied', auto: false, decided_by_name: 'Mom', note: "let's talk Sat", created_at: '2026-10-24T17:12:00Z', decided_at: '2026-10-24T17:12:00Z' },
  ],
}

describe('rewards: history', () => {
  test('KPIs, chips, amounts; a kid filter refetches with kid_id', async () => {
    data({ '/redemptions/history?days=30': hist, '/redemptions/history?days=30&kid_id=8': { ...hist, rows: [hist.rows[1]] } })
    mockRoute.query = { section: 'rewards', item: 'history' }
    render(wrap(<KidsPage />))
    const pane = detail()
    expect(await within(pane).findByText('6h 15m')).toBeInTheDocument()
    expect(within(pane).getByText('2,140')).toBeInTheDocument()
    const maya = within(pane).getByText('15 min screen time').closest('li') as HTMLElement
    expect(maya).toHaveTextContent('auto-approved')
    expect(maya).toHaveTextContent('Auto')
    expect(maya).toHaveTextContent('−20')
    const leo = within(pane).getByText('New game').closest('li') as HTMLElement
    expect(leo).toHaveTextContent('declined by Mom · “let\'s talk Sat”')
    expect(leo).toHaveTextContent('Declined')
    await userEvent.click(within(pane).getByRole('button', { name: 'Leo' }))
    await waitFor(() => expect(apiMock).toHaveBeenCalledWith('/redemptions/history?days=30&kid_id=8'))
    await waitFor(() => expect(within(pane).queryByText('15 min screen time')).toBeNull())
  })

  test('Export CSV downloads rewards-history.csv with a header line', async () => {
    data({ '/redemptions/history?days=30': hist })
    mockRoute.query = { section: 'rewards', item: 'history' }
    render(wrap(<KidsPage />))
    await userEvent.click(await within(detail()).findByRole('button', { name: 'Export CSV' }))
    expect(mockDownload).toHaveBeenCalledWith('rewards-history.csv', expect.stringMatching(/^date,kid,item,kind,status,points,decided_by,note\n/))
  })

  test('no rows shows Nothing yet', async () => {
    data({ '/redemptions/history?days=30': { totals: { spent: 0, screen_minutes: 0, approved: 0, declined: 0 }, rows: [] } })
    mockRoute.query = { section: 'rewards', item: 'history' }
    render(wrap(<KidsPage />))
    expect(await within(detail()).findByText('Nothing yet')).toBeInTheDocument()
  })
})
