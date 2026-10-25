import { beforeAll, beforeEach, describe, expect, test } from '@jest/globals'
import type { Mock } from 'jest-mock'
import type { ReactNode } from 'react'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MantineProvider } from '@mantine/core'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fridgeTheme } from '@/v2/theme'
import { api } from '@/v2/api'
import { KidsPage } from '@/v2/manage/KidsPage'
import type { Kid } from '@/v2/types'

let query: Record<string, string> = {}
const push = jest.fn()
const replace = jest.fn()
jest.mock('@mantine/notifications', () => ({ notifications: { show: jest.fn() } }))
jest.mock('next/router', () => ({ useRouter: () => ({ query, push, replace, pathname: '/kids' }) }))
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

const apiMock = api as unknown as Mock<(p: string, init?: { method?: string; body?: unknown }) => Promise<unknown>>
const calls = (method: string) => apiMock.mock.calls.filter(([, i]) => i?.method === method)

const kids: Kid[] = [
  { id: 7, full_name: 'Maya', username: 'kid-maya', avatar: null, has_pin: false },
  { id: 8, full_name: 'Leo', username: 'kid-leo', avatar: '🦊', has_pin: true },
]
const asg = (over = {}) => ({
  id: 11,
  chore_id: 5,
  kid_ids: [7],
  mode: 'each',
  repeat: { type: 'daily', days: [] },
  on_date: null,
  due_time: '19:00',
  active: true,
  ...over,
})
const lib = (over = {}) => ({
  id: 5,
  title: 'Clean room',
  points: 15,
  needs_photo: false,
  steps: [
    { id: 1, title: 'Fold clothes' },
    { id: 2, title: 'Make bed' },
  ],
  assignments: [asg()],
  archived: false,
  ...over,
})
const defs = [
  lib(),
  lib({ id: 6, title: 'Trash', steps: [], assignments: [asg({ id: 12, chore_id: 6, kid_ids: [7, 8], mode: 'race' })] }),
  lib({ id: 9, title: 'Unassigned', steps: [], assignments: [] }),
]

const wrap = (ui: ReactNode) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MantineProvider theme={fridgeTheme}>{ui}</MantineProvider>
  </QueryClientProvider>
)

beforeAll(() => {
  window.matchMedia ??= ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} })) as never
  global.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  Element.prototype.scrollIntoView = jest.fn()
})

const serve = (over: Record<string, unknown> = {}) =>
  apiMock.mockReset().mockImplementation(async (path) => {
    if (path in over) return over[path]
    if (path === '/kids') return kids
    if (path === '/chores/') return defs
    if (path === '/today') return { kids: [{ id: 8, name: 'Leo', points: 42, progress: { level: 3 } }] }
    if (path === '/devices') return [{ id: 1, name: 'Leo iPad', owner_ids: [8], online: true }]
    if (path === '/rewards' || path === '/custom-badges') return []
    return {}
  })

beforeEach(() => {
  query = {}
  push.mockReset()
  replace.mockReset()
  serve()
})

const list = () => screen.getByTestId('list')
const detail = () => screen.getByTestId('detail')
const who = () => within(detail()).getByRole('region', { name: 'Who and when' })
const show = async (q: Record<string, string>) => {
  query = q
  render(wrap(<KidsPage />))
  await within(list()).findByText('Trash')
}
const nav = (q: Record<string, string | number>) => [{ pathname: '/kids', query: q }, undefined, { shallow: true }]

describe('tabs and list', () => {
  test('default is chores with the tab pressed; a tab click replaces ?section', async () => {
    await show({})
    const tabs = within(list()).getByRole('group', { name: 'Section' })
    expect(within(tabs).getByRole('button', { name: 'Chores · 3' })).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(within(tabs).getByRole('button', { name: 'Kids · 2' }))
    expect(replace).toHaveBeenCalledWith({ pathname: '/kids', query: { section: 'kids' } })
  })

  test('chore cards show the summary line and letter avatars; archived are not requested', async () => {
    await show({})
    const card = within(list()).getByRole('button', { name: /Clean room/ })
    expect(card).toHaveTextContent('15 pts · daily · 2 steps')
    expect(within(list()).getAllByRole('img', { name: 'Leo' })).toHaveLength(1)
    expect(within(card).getByRole('img', { name: 'Maya' })).toHaveTextContent('M')
    expect(apiMock).toHaveBeenCalledWith('/chores/')
  })

  test('clicking a card selects it with ?item; the dashed card starts a new chore', async () => {
    await show({})
    await userEvent.click(within(list()).getByRole('button', { name: /Trash/ }))
    expect(push).toHaveBeenLastCalledWith(...nav({ section: 'chores', item: 6 }))
    await userEvent.click(within(list()).getByRole('button', { name: 'New chore' }))
    expect(push).toHaveBeenLastCalledWith(...nav({ section: 'chores', item: 'new' }))
  })

  test('nothing selected shows a prompt', async () => {
    await show({})
    expect(detail()).toHaveTextContent('Pick a chore to see its details.')
  })
})

describe('chore detail', () => {
  test('header shows points and schedule chips, no photo chip when not needed', async () => {
    await show({ item: '6' })
    expect(within(detail()).getByRole('heading', { name: 'Trash' })).toBeInTheDocument()
    expect(within(detail()).getByText('15 pts')).toBeInTheDocument()
    expect(within(detail()).getByText('daily')).toBeInTheDocument()
    expect(within(detail()).queryByText('Needs photo')).toBeNull()
  })

  test('create POSTs chore fields only, then selects the new chore', async () => {
    apiMock.mockImplementation(async (path, init) => {
      if (init?.method === 'POST' && path === '/chores/') return lib({ id: 20, title: 'Laundry', assignments: [], steps: [] })
      if (path === '/kids') return kids
      if (path === '/chores/') return defs
      if (path === '/today') return { kids: [] }
      return []
    })
    await show({ item: 'new' })
    expect(within(who()).getByText(/Save the chore first/)).toBeInTheDocument()
    await userEvent.type(within(detail()).getByLabelText('Chore'), 'Laundry')
    for (const s of ['Fold clothes', 'Make bed']) {
      await userEvent.type(within(detail()).getByLabelText('Add a step'), `${s}{Enter}`)
    }
    await userEvent.click(within(detail()).getByRole('switch', { name: 'Needs a photo' }))
    await userEvent.click(within(detail()).getByRole('button', { name: 'Save chore' }))
    await waitFor(() =>
      expect(calls('POST')[0]).toEqual([
        '/chores/',
        { method: 'POST', body: { title: 'Laundry', points: 10, needs_photo: true, steps: ['Fold clothes', 'Make bed'] } },
      ]),
    )
    await waitFor(() => expect(push).toHaveBeenCalledWith(...nav({ section: 'chores', item: 20 })))
  })

  test('saving PATCHes only chore fields, with reordered steps', async () => {
    await show({ item: '5' })
    await userEvent.click(within(detail()).getByRole('button', { name: 'Move down Fold clothes' }))
    await userEvent.click(within(detail()).getByRole('button', { name: 'Save chore' }))
    await waitFor(() => expect(calls('PATCH')).toHaveLength(1))
    expect(calls('PATCH')[0]).toEqual([
      '/chores/5',
      { method: 'PATCH', body: { title: 'Clean room', points: 15, needs_photo: false, steps: ['Make bed', 'Fold clothes'] } },
    ])
  })

  test('Assign posts AssignmentIn with exact keys; mode hidden with one kid', async () => {
    await show({ item: '9' })
    expect(within(who()).getByText(/Nobody has this chore yet/)).toBeInTheDocument()
    await userEvent.click(within(who()).getByRole('button', { name: 'Maya' }))
    expect(within(who()).queryByRole('group', { name: 'Mode' })).toBeNull()
    fireEvent.change(within(who()).getByLabelText('Due by (optional)'), { target: { value: '17:00' } })
    await userEvent.click(within(who()).getByRole('button', { name: 'Save' }))
    await waitFor(() =>
      expect(calls('POST')[0]).toEqual([
        '/chores/9/assignments',
        {
          method: 'POST',
          body: { kid_ids: [7], mode: 'each', repeat: { type: 'daily', days: [] }, on_date: null, due_time: '17:00' },
        },
      ]),
    )
  })

  test('two kids show the mode control and its hint', async () => {
    await show({ item: '9' })
    await userEvent.click(within(who()).getByRole('button', { name: 'Maya' }))
    await userEvent.click(within(who()).getByRole('button', { name: 'Leo' }))
    expect(within(who()).getByText(/own copy and their own points/)).toBeInTheDocument()
    await userEvent.click(within(who()).getByRole('button', { name: 'First one wins' }))
    expect(within(who()).getByText(/first kid to finish/)).toBeInTheDocument()
    await userEvent.click(within(who()).getByRole('button', { name: 'Team effort' }))
    expect(within(who()).getByText(/split evenly/)).toBeInTheDocument()
  })

  test('Some days shows weekday circles; Save sends the chosen days', async () => {
    await show({ item: '9' })
    await userEvent.click(within(who()).getByRole('button', { name: 'Maya' }))
    await userEvent.click(within(who()).getByRole('button', { name: 'Some days' }))
    const save = within(who()).getByRole('button', { name: 'Save' })
    expect(save).toBeDisabled()
    const wed = within(who()).getByRole('button', { name: 'Wed' })
    await userEvent.click(within(who()).getByRole('button', { name: 'Mon' }))
    await userEvent.click(wed)
    expect(wed).toHaveAttribute('aria-pressed', 'true')
    expect(wed).toHaveTextContent('W')
    await userEvent.click(save)
    await waitFor(() => expect(calls('POST')[0][1]?.body).toMatchObject({ repeat: { type: 'weekly', days: [0, 2] } }))
  })

  test('One time needs a date before Save is enabled', async () => {
    await show({ item: '9' })
    await userEvent.click(within(who()).getByRole('button', { name: 'Maya' }))
    await userEvent.click(within(who()).getByRole('button', { name: 'One time' }))
    const save = within(who()).getByRole('button', { name: 'Save' })
    expect(save).toBeDisabled()
    fireEvent.change(within(who()).getByLabelText('Date'), { target: { value: '2026-11-01' } })
    expect(save).toBeEnabled()
    await userEvent.click(save)
    await waitFor(() => expect(calls('POST')[0][1]?.body).toMatchObject({ repeat: { type: 'once', days: [] }, on_date: '2026-11-01' }))
  })

  test('editing an assignment PATCHes it; removing DELETEs it', async () => {
    await show({ item: '5' })
    expect(within(who()).getByRole('button', { name: 'Maya' })).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(within(who()).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(calls('PATCH')[0][0]).toBe('/assignments/11'))
    await userEvent.click(within(who()).getByRole('button', { name: 'Remove' }))
    const confirm = await screen.findByRole('dialog', { name: 'Remove this assignment?' })
    await userEvent.click(within(confirm).getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(calls('DELETE')[0]).toEqual(['/assignments/11', { method: 'DELETE' }]))
  })

  test('Duplicate POSTs /copy', async () => {
    await show({ item: '5' })
    await userEvent.click(within(detail()).getByRole('button', { name: 'Duplicate' }))
    await waitFor(() => expect(calls('POST')[0]).toEqual(['/chores/5/copy', { method: 'POST' }]))
  })

  test('Delete asks first, says history stays, then DELETEs and closes the detail', async () => {
    await show({ item: '5' })
    await userEvent.click(within(detail()).getByRole('button', { name: 'Delete' }))
    expect(calls('DELETE')).toHaveLength(0)
    const confirm = await screen.findByRole('dialog', { name: 'Delete Clean room?' })
    expect(within(confirm).getByText('Chores already done stay in history.')).toBeInTheDocument()
    await userEvent.click(within(confirm).getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(calls('DELETE')[0]).toEqual(['/chores/5', { method: 'DELETE' }]))
    await waitFor(() => expect(push).toHaveBeenCalledWith(...nav({ section: 'chores' })))
  })
})

describe('kids', () => {
  test('list shows letter avatars, balance and status chips, never the emoji', async () => {
    query = { section: 'kids' }
    render(wrap(<KidsPage />))
    const leo = await within(list()).findByRole('button', { name: /Leo/ })
    await waitFor(() => expect(leo).toHaveTextContent('42 pts · Level 3'))
    expect(within(list()).getByRole('button', { name: /Maya/ })).toHaveTextContent('No PIN')
    expect(within(list()).getByRole('button', { name: 'Add a kid' })).toBeInTheDocument()
    expect(document.body.textContent).not.toContain('🦊')
  })

  test('detail has View as kid, Bonus, Deduct, Edit, plus chores and devices', async () => {
    query = { section: 'kids', item: '8' }
    render(wrap(<KidsPage />))
    expect(await within(detail()).findByRole('link', { name: 'View as kid' })).toHaveAttribute('href', '/kid?as=8')
    for (const name of ['Bonus', 'Deduct', 'Edit']) expect(within(detail()).getByRole('button', { name })).toBeInTheDocument()
    expect(await within(detail()).findByText('Leo iPad')).toBeInTheDocument()
    expect(within(detail()).getByRole('region', { name: 'Chores assigned' })).toHaveTextContent('Trash')
    expect(document.body.textContent).not.toContain('🦊')
  })

  test('Edit opens KidEditor; Remove PIN PATCHes', async () => {
    query = { section: 'kids', item: '8' }
    render(wrap(<KidsPage />))
    await userEvent.click(await within(detail()).findByRole('button', { name: 'Edit' }))
    await userEvent.click(await within(detail()).findByRole('button', { name: 'Remove PIN' }))
    await waitFor(() => expect(calls('PATCH')[0]).toEqual(['/kids/8', { method: 'PATCH', body: { clear_pin: true } }]))
  })

  test('Bonus POSTs /points and Deduct POSTs /deduct with amount and note', async () => {
    serve({ '/kids/8/points': { balance: 50 }, '/kids/8/deduct': { balance: 10, deducted: 5 } })
    query = { section: 'kids', item: '8' }
    render(wrap(<KidsPage />))
    await userEvent.click(await within(detail()).findByRole('button', { name: 'Bonus' }))
    expect(within(detail()).getByRole('button', { name: 'Send points' })).toBeDisabled()
    await userEvent.type(within(detail()).getByLabelText(/Points/), '8')
    await userEvent.type(within(detail()).getByLabelText('Why?'), 'Helped out')
    await userEvent.click(within(detail()).getByRole('button', { name: 'Send points' }))
    await waitFor(() => expect(calls('POST')[0]).toEqual(['/kids/8/points', { method: 'POST', body: { amount: 8, note: 'Helped out' } }]))

    await userEvent.click(within(detail()).getByRole('button', { name: 'Deduct' }))
    await userEvent.type(within(detail()).getByLabelText(/Points/), '5')
    await userEvent.type(within(detail()).getByLabelText('Why?'), 'Broke a rule')
    await userEvent.click(within(detail()).getByRole('button', { name: 'Take points' }))
    await waitFor(() => expect(calls('POST')[1]).toEqual(['/kids/8/deduct', { method: 'POST', body: { amount: 5, note: 'Broke a rule' } }]))
  })
})

describe('rewards and badges', () => {
  test('rewards tab lists cards with price and a dashed New reward card; detail edits the price', async () => {
    serve({ '/rewards': [{ id: 3, name: 'Movie night', price: 150, icon: null }] })
    query = { section: 'rewards', item: '3' }
    render(wrap(<KidsPage />))
    expect(await within(list()).findByRole('button', { name: /Movie night/ })).toHaveTextContent('150 pts')
    expect(within(list()).getByRole('button', { name: 'New reward' })).toBeInTheDocument()
    expect(within(detail()).getByLabelText('Price (points)')).toHaveValue(150)
  })

  test('new reward posts name and price', async () => {
    query = { section: 'rewards', item: 'new' }
    render(wrap(<KidsPage />))
    await userEvent.type(await screen.findByLabelText('Reward'), 'Pizza')
    await userEvent.clear(screen.getByLabelText('Price (points)'))
    await userEvent.type(screen.getByLabelText('Price (points)'), '80')
    await userEvent.click(screen.getByRole('button', { name: 'Add reward' }))
    await waitFor(() => expect(calls('POST')[0]).toEqual(['/rewards', { method: 'POST', body: { name: 'Pizza', price: 80 } }]))
  })

  test('badges tab lists custom badges; detail awards the picked kid', async () => {
    serve({
      '/custom-badges': [{ id: 3, name: 'Helper', icon: 'star', description: 'Helped out' }],
      '/custom-badges/3/award': { tier: 2 },
    })
    query = { section: 'badges', item: '3' }
    render(wrap(<KidsPage />))
    expect(await within(list()).findByRole('button', { name: /Helper/ })).toHaveTextContent('Helped out')
    expect(within(list()).getByRole('button', { name: 'New badge' })).toBeInTheDocument()
    const award = await within(detail()).findByRole('button', { name: 'Award' })
    expect(award).toBeDisabled()
    await userEvent.click(within(detail()).getByRole('button', { name: 'Leo' }))
    await userEvent.click(award)
    await waitFor(() => expect(calls('POST')[0]).toEqual(['/custom-badges/3/award', { method: 'POST', body: { kid_id: 8 } }]))
  })

  test('new badge posts name, icon and description', async () => {
    query = { section: 'badges', item: 'new' }
    render(wrap(<KidsPage />))
    await userEvent.type(await screen.findByLabelText('Badge name'), 'Kind')
    await userEvent.click(screen.getByTitle('star'))
    await userEvent.type(screen.getByLabelText('Description'), 'Was kind')
    await userEvent.click(screen.getByRole('button', { name: 'Add badge' }))
    await waitFor(() =>
      expect(calls('POST')[0]).toEqual(['/custom-badges', { method: 'POST', body: { name: 'Kind', icon: 'star', description: 'Was kind' } }]),
    )
  })
})
