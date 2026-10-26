import { describe, expect, test } from '@jest/globals'
import type { ReactNode } from 'react'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { notifications } from '@mantine/notifications'
import { KidsPage } from '@/v2/manage/KidsPage'
import { calls, detail, list, mockRoute, serve, setupLibrary, wrap } from './libraryHelpers'

jest.mock('@mantine/notifications', () => ({ notifications: { show: jest.fn(), hide: jest.fn() } }))
jest.mock('next/router', () => ({
  useRouter: () => ({ query: mockRoute.query, push: mockRoute.push, replace: mockRoute.replace, pathname: '/kids' }),
}))
jest.mock('@/v2/api', () => ({ api: jest.fn() }))
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
    expect(within(list()).getByRole('button', { name: /Catalogue/ })).toHaveTextContent('2 rewards · 1 hidden')
  })
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
