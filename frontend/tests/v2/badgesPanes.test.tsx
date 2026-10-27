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

const kids = [
  { id: 7, full_name: 'Mia', username: 'kid-mia', avatar: null, has_pin: false },
  { id: 8, full_name: 'Leo', username: 'kid-leo', avatar: null, has_pin: false },
]
const overview = [
  { key: 'on_fire', name: 'On Fire', description: 'Days in a row, all chores done', icon: '🔥', custom: false, tiers: { '7': 2 } },
  { key: 'custom:3', name: 'Kindness', description: 'Helped someone', icon: 'volunteer_activism', custom: true, tiers: { '7': 3, '8': 5 } },
]
const recent = [
  { id: 1, kid_id: 7, kid_name: 'Ava', key: 'custom:3', name: 'Kindness', icon: 'volunteer_activism', custom: true, tier: 1, tier_name: 'copper', note: 'shared her snack', by_name: 'Mom', earned_at: new Date().toISOString() },
  { id: 2, kid_id: 7, kid_name: 'Mia', key: 'on_fire', name: 'On Fire', icon: '🔥', custom: false, tier: 2, tier_name: 'silver', note: null, by_name: null, earned_at: new Date().toISOString() },
]
const data = (over: Record<string, unknown> = {}) =>
  serve({
    '/kids': kids,
    '/badges/overview': overview,
    '/badges/recent': recent,
    '/custom-badges': [{ id: 3, name: 'Kindness', icon: 'volunteer_activism', description: 'Helped someone' }],
    '/custom-badges/3/award': { tier: 4 },
    ...over,
  })

describe('badges panes', () => {
  test('nav lists All, Custom and Recent with counts; no item opens All', async () => {
    data()
    mockRoute.query = { section: 'badges' }
    render(wrap(<KidsPage />))
    expect(await within(detail()).findByRole('heading', { name: 'Badges' })).toBeInTheDocument()
    await waitFor(() => expect(within(list()).getByRole('button', { name: /Custom badges/ })).toHaveTextContent('1 made by you · award one'))
    await waitFor(() => expect(within(list()).getByRole('button', { name: /Recent awards/ })).toHaveTextContent('2 this week'))
    expect(within(list()).getByRole('button', { name: /All badges/ })).toHaveTextContent('Who has what, by tier')
  })

  test('All shows the built-in glyph and tier pips per kid', async () => {
    data()
    mockRoute.query = { section: 'badges', item: 'all' }
    render(wrap(<KidsPage />))
    const card = (await within(detail()).findByText('On Fire')).closest('article') as HTMLElement
    expect(card).toHaveTextContent('whatshot')
    expect(card).not.toHaveTextContent('🔥')
    const pips = within(card).getByRole('img', { name: 'Silver' })
    expect(pips.querySelectorAll('i')).toHaveLength(5)
    const lit = [...pips.querySelectorAll('i')].map((i) => (i as HTMLElement).style.background)
    expect(lit.slice(0, 2)).toEqual(['rgb(184, 115, 51)', 'rgb(192, 192, 192)'])
    expect(lit.slice(2)).toEqual(['', '', ''])
    expect(within(card).getByRole('img', { name: 'Not earned' })).toBeInTheDocument()
    expect(within(detail()).getByText('1 built-in')).toBeInTheDocument()
    expect(within(detail()).getByText('1 custom')).toBeInTheDocument()
    expect(within(detail()).getByText('2 new this week')).toBeInTheDocument()
    const kind = (within(detail()).getByText('Kindness').closest('article') as HTMLElement)
    expect(kind).toHaveTextContent('Custom')
  })

  test('Award previews the next tier and posts kid_id and note', async () => {
    data()
    mockRoute.query = { section: 'badges', item: 'custom', pick: '3' }
    render(wrap(<KidsPage />))
    const award = await within(detail()).findByRole('region', { name: 'Award it' })
    await waitFor(() => expect(within(award).getByTestId('award-preview')).toHaveTextContent(/Mia goes\s*Gold.*Platinum/))
    await userEvent.type(within(award).getByLabelText('Note to Mia (optional)'), 'Helped Leo read')
    await userEvent.click(within(award).getByRole('button', { name: 'Award to Mia' }))
    await waitFor(() =>
      expect(calls('POST')[0]).toEqual(['/custom-badges/3/award', { method: 'POST', body: { kid_id: 7, note: 'Helped Leo read' } }]),
    )
    await waitFor(() => expect(notifications.show).toHaveBeenCalledWith(expect.objectContaining({ message: 'Kindness: Platinum' })))
  })

  test('a kid already at Mega-diamond cannot be awarded again', async () => {
    data()
    mockRoute.query = { section: 'badges', item: 'custom', pick: '3' }
    render(wrap(<KidsPage />))
    const award = await within(detail()).findByRole('region', { name: 'Award it' })
    await userEvent.click(within(award).getByRole('button', { name: 'Leo' }))
    expect(within(award).getByTestId('award-preview')).toHaveTextContent('Already Mega-diamond')
    expect(within(award).getByRole('button', { name: 'Award to Leo' })).toBeDisabled()
  })

  test('Recent shows who gave it and the note', async () => {
    data()
    mockRoute.query = { section: 'badges', item: 'recent' }
    render(wrap(<KidsPage />))
    expect(await within(detail()).findByText('Ava got Kindness · Copper')).toBeInTheDocument()
    expect(within(detail()).getByText(/Given by Mom · “shared her snack” · today/)).toBeInTheDocument()
    expect(within(detail()).getByText('Mia reached On Fire · Silver')).toBeInTheDocument()
  })

  test('Recent with nothing shows the empty state', async () => {
    data({ '/badges/recent': [] })
    mockRoute.query = { section: 'badges', item: 'recent' }
    render(wrap(<KidsPage />))
    expect(await within(detail()).findByText('No awards this week')).toBeInTheDocument()
  })

  test('New badge opens the editor', async () => {
    data()
    mockRoute.query = { section: 'badges', item: 'custom' }
    render(wrap(<KidsPage />))
    await userEvent.click(await within(detail()).findByRole('button', { name: 'New badge' }))
    expect(mockRoute.push).toHaveBeenCalledWith(
      { pathname: '/kids', query: { section: 'badges', item: 'custom', pick: 'new' } },
      undefined,
      { shallow: true },
    )
  })

  test('New badge sends a glyph icon', async () => {
    data()
    mockRoute.query = { section: 'badges', item: 'custom', pick: 'new' }
    render(wrap(<KidsPage />))
    await userEvent.type(await screen.findByLabelText('Badge name'), 'Pet hero')
    await userEvent.click(screen.getByTitle('pets'))
    await userEvent.click(screen.getByRole('button', { name: 'Add badge' }))
    await waitFor(() =>
      expect(calls('POST')[0]).toEqual(['/custom-badges', { method: 'POST', body: { name: 'Pet hero', icon: 'pets', description: '' } }]),
    )
  })
  test('saving or deleting a badge refetches the overview and recent awards', async () => {
    data({ '/custom-badges/3': {} })
    mockRoute.query = { section: 'badges', item: 'custom', pick: '3' }
    render(wrap(<KidsPage />))
    const fetched = (p: string) => apiMock.mock.calls.filter(([path, i]) => path === p && !i?.method).length
    await waitFor(() => expect(fetched('/badges/overview')).toBeGreaterThan(0))
    const o = fetched('/badges/overview')
    const r = fetched('/badges/recent')
    await userEvent.click(await within(detail()).findByRole('button', { name: 'Save badge' }))
    await waitFor(() => expect(fetched('/badges/overview')).toBeGreaterThan(o))
    await waitFor(() => expect(fetched('/badges/recent')).toBeGreaterThan(r))
    const o2 = fetched('/badges/overview')
    await userEvent.click(within(detail()).getByRole('button', { name: 'Delete badge' }))
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(fetched('/badges/overview')).toBeGreaterThan(o2))
  })
})
