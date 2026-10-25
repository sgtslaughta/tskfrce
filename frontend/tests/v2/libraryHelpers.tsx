import { beforeAll, beforeEach } from '@jest/globals'
import type { Mock } from 'jest-mock'
import type { ReactNode } from 'react'
import { render, screen, within } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fridgeTheme } from '@/v2/theme'
import { api } from '@/v2/api'
import { KidsPage } from '@/v2/manage/KidsPage'
import { clearChoreDrafts } from '@/v2/manage/ChoreDetail'
import type { Kid } from '@/v2/types'

/** Shared fixtures for the choreLibrary / kidsRewards tests. Each test file keeps its own jest.mock calls. */
export const mockRoute = {
  query: {} as Record<string, string>,
  push: jest.fn(),
  replace: jest.fn(),
}

export const apiMock = api as unknown as Mock<
  (p: string, init?: { method?: string; body?: unknown }) => Promise<unknown>
>
export const calls = (method: string) =>
  apiMock.mock.calls.filter(([, i]) => i?.method === method)

export const kids: Kid[] = [
  {
    id: 7,
    full_name: 'Maya',
    username: 'kid-maya',
    avatar: null,
    has_pin: false,
  },
  { id: 8, full_name: 'Leo', username: 'kid-leo', avatar: '🦊', has_pin: true },
]
export const asg = (over = {}) => ({
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
export const lib = (over = {}) => ({
  id: 5,
  title: 'Clean room',
  points: 15,
  needs_photo: false,
  steps: [
    { id: 1, title: 'Fold clothes', due_time: null, after_previous: false },
    { id: 2, title: 'Make bed', due_time: null, after_previous: false },
  ],
  assignments: [asg()],
  archived: false,
  ...over,
})
export const defs = [
  lib(),
  lib({
    id: 6,
    title: 'Trash',
    steps: [],
    assignments: [asg({ id: 12, chore_id: 6, kid_ids: [7, 8], mode: 'race' })],
  }),
  lib({ id: 9, title: 'Unassigned', steps: [], assignments: [] }),
]

export const wrap = (ui: ReactNode) => (
  <QueryClientProvider
    client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
  >
    <MantineProvider theme={fridgeTheme}>{ui}</MantineProvider>
  </QueryClientProvider>
)

export const serve = (over: Record<string, unknown> = {}) =>
  apiMock.mockReset().mockImplementation(async (path) => {
    if (path in over) return over[path]
    if (path === '/kids') return kids
    if (path === '/chores/') return defs
    if (path === '/today')
      return {
        kids: [{ id: 8, name: 'Leo', points: 42, progress: { level: 3 } }],
      }
    if (path === '/devices')
      return [{ id: 1, name: 'Leo iPad', owner_ids: [8], online: true }]
    if (
      path === '/rewards' ||
      path === '/custom-badges' ||
      path === '/chore-types'
    )
      return []
    return {}
  })

/** Call once at the top level of a test file. */
export function setupLibrary() {
  beforeAll(() => {
    window.matchMedia ??= ((q: string) => ({
      matches: false,
      media: q,
      addEventListener() {},
      removeEventListener() {},
    })) as never
    global.ResizeObserver ??= class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    Element.prototype.scrollIntoView = jest.fn()
  })

  beforeEach(() => {
    mockRoute.query = {}
    clearChoreDrafts()
    mockRoute.push.mockReset()
    mockRoute.replace.mockReset()
    serve()
  })
}

export const list = () => screen.getByTestId('list')
export const detail = () => screen.getByTestId('detail')
export const who = () =>
  within(detail()).getByRole('region', { name: 'Who and when' })
export const show = async (q: Record<string, string>) => {
  mockRoute.query = q
  render(wrap(<KidsPage />))
  await within(list()).findByText('Trash')
}
export const nav = (q: Record<string, string | number>) => [
  { pathname: '/kids', query: q },
  undefined,
  { shallow: true },
]
