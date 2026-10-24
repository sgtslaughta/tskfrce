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
jest.mock('@mantine/notifications', () => ({ notifications: { show: jest.fn() } }))
jest.mock('next/router', () => ({ useRouter: () => ({ query, replace: jest.fn() }) }))
jest.mock('@/v2/api', () => ({ api: jest.fn() }))
jest.mock('@/v2/parent/ParentShell', () => ({
  ParentShell: ({ children }: { children: ReactNode }) => <>{children}</>,
}))
jest.mock('@/v2/components/FridgeShell', () => ({
  FridgeShell: ({ children }: { children: ReactNode }) => <>{children}</>,
}))
jest.mock('@/v2/components/RequireParent', () => ({
  RequireParent: ({ children }: { children: ReactNode }) => <>{children}</>,
  startSignOut: jest.fn(),
  cancelSignOut: jest.fn(),
}))
jest.mock('@/v2/parent/useLook', () => ({
  useLook: jest.fn(),
}))
jest.mock('@/contexts/UnifiedAuthContext', () => ({
  useUnifiedAuth: jest.fn(() => ({
    user: { id: '1', username: 'testuser' },
    logout: jest.fn(),
  })),
}))
jest.mock('@/v2/chat/ChatDock', () => ({
  ChatDock: () => null,
}))
jest.mock('@/v2/components/BlockerBanner', () => ({
  BlockerBanner: () => null,
}))
jest.mock('@/v2/components/Bell', () => ({
  Bell: () => null,
}))
jest.mock('@/v2/hooks/useChat', () => ({
  useThreads: jest.fn(() => ({
    data: { total: 0 },
  })),
}))

const apiMock = api as unknown as Mock<(p: string, init?: { method?: string; body?: unknown }) => Promise<unknown>>
const calls = (method: string) => apiMock.mock.calls.filter(([, i]) => i?.method === method)

const kids: Kid[] = [
  { id: 7, full_name: 'Maya', username: 'kid-maya', avatar: null, has_pin: false },
  { id: 8, full_name: 'Leo', username: 'kid-leo', avatar: null, has_pin: true },
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

beforeEach(() => {
  query = {}
  apiMock.mockReset().mockImplementation(async (path) => {
    if (path === '/kids') return kids
    if (path === '/chores/') return defs
    if (path === '/chores/today') return { '7': [{ id: 1, status: 'done' }, { id: 2, status: 'todo' }] }
    if (path === '/rewards') return []
    return {}
  })
})

const open = async () => {
  render(wrap(<KidsPage />))
  return screen.findByText('Clean room')
}
const dialog = () => screen.findByRole('dialog')

describe('sections', () => {
  test('default is chores; ?section=kids shows kids list; sidebar links carry the section', async () => {
    const { unmount } = render(wrap(<KidsPage />))
    expect(await screen.findByText('Clean room')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /^Kids/ })).toHaveAttribute('href', '/kids?section=kids')
    expect(screen.getByRole('link', { name: /^Chores/ })).toHaveAttribute('aria-current', 'page')
    unmount()
    query = { section: 'kids' }
    render(wrap(<KidsPage />))
    expect(await screen.findByRole('button', { name: 'Add a kid' })).toBeInTheDocument()
    expect(screen.queryByText('Clean room')).toBeNull()
  })

  test('kid filter chips show per-kid done/total; no sidebar kid list', async () => {
    await open()
    expect(screen.getByText('Maya').closest('label')).toHaveTextContent(/Maya\s*1\/2/)
    expect(screen.queryByRole('link', { name: /Maya/ })).toBeNull()
  })

  test('Shared filter shows only multi-kid chores', async () => {
    await open()
    await userEvent.click(screen.getByText('Shared'))
    expect(screen.getByText('Trash')).toBeInTheDocument()
    expect(screen.queryByText('Clean room')).toBeNull()
  })

  test('Kids section edits a kid through KidEditor', async () => {
    query = { section: 'kids' }
    render(wrap(<KidsPage />))
    await userEvent.click(await screen.findByRole('button', { name: /Leo/ }))
    const d = await dialog()
    await userEvent.click(within(d).getByRole('button', { name: 'Remove PIN' }))
    await waitFor(() => expect(calls('PATCH')[0]).toEqual(['/kids/8', { method: 'PATCH', body: { clear_pin: true } }]))
  })
})

describe('chore library', () => {
  test('rows show steps count and Used by avatars; archived are not requested', async () => {
    await open()
    expect(screen.getByText('2 steps')).toBeInTheDocument()
    expect(screen.getAllByRole('img', { name: 'Leo' })).toHaveLength(1)
    expect(apiMock).toHaveBeenCalledWith('/chores/')
  })

  test('kid chip filters by assignment', async () => {
    await open()
    await userEvent.click(screen.getByText('Leo'))
    expect(screen.getByText('Trash')).toBeInTheDocument()
    expect(screen.queryByText('Clean room')).toBeNull()
    expect(screen.queryByText('Unassigned')).toBeNull()
  })

  test('create POSTs chore fields only, then offers Assign', async () => {
    apiMock.mockImplementation(async (path, init) => {
      if (init?.method === 'POST' && path === '/chores/') return lib({ id: 20, title: 'Laundry', assignments: [], steps: [] })
      if (path === '/kids') return kids
      if (path === '/chores/') return [...defs, lib({ id: 20, title: 'Laundry', assignments: [], steps: [] })]
      return {}
    })
    await open()
    await userEvent.click(screen.getByRole('button', { name: 'New chore' }))
    const d = await dialog()
    await userEvent.type(within(d).getByLabelText('Chore'), 'Laundry')
    for (const s of ['Fold clothes', 'Make bed']) {
      await userEvent.type(within(d).getByLabelText('Add a step'), `${s}{Enter}`)
    }
    await userEvent.click(within(d).getByRole('button', { name: 'Save' }))
    await waitFor(() =>
      expect(calls('POST')[0]).toEqual([
        '/chores/',
        { method: 'POST', body: { title: 'Laundry', points: 10, needs_photo: false, steps: ['Fold clothes', 'Make bed'] } },
      ]),
    )
    expect(await within(d).findByRole('button', { name: 'Assign' })).toBeInTheDocument()
  })

  test('saving PATCHes only chore fields, with reordered steps', async () => {
    await open()
    await userEvent.click(screen.getByText('Clean room'))
    const d = await dialog()
    await userEvent.click(within(d).getByRole('button', { name: 'Move down Fold clothes' }))
    await userEvent.click(within(d).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(calls('PATCH')).toHaveLength(1))
    expect(calls('PATCH')[0]).toEqual([
      '/chores/5',
      { method: 'PATCH', body: { title: 'Clean room', points: 15, needs_photo: false, steps: ['Make bed', 'Fold clothes'] } },
    ])
  })

  test('Assign posts AssignmentIn with exact keys; mode hidden with one kid', async () => {
    await open()
    await userEvent.click(screen.getByText('Unassigned'))
    const d = await dialog()
    await userEvent.click(within(d).getByRole('button', { name: 'Assign' }))
    await userEvent.click(within(d).getByText('Maya'))
    expect(within(d).queryByLabelText('Mode')).toBeNull()
    fireEvent.change(within(d).getByLabelText('Due by (optional)'), { target: { value: '17:00' } })
    await userEvent.click(within(d).getByRole('button', { name: 'Save' }))
    await waitFor(() =>
      expect(calls('POST')[0]).toEqual([
        '/chores/9/assignments',
        {
          method: 'POST',
          body: {
            kid_ids: [7],
            mode: 'each',
            repeat: { type: 'daily', days: [] },
            on_date: null,
            due_time: '17:00',
          },
        },
      ]),
    )
  })

  test('two kids show the mode control and its hint', async () => {
    await open()
    await userEvent.click(screen.getByText('Unassigned'))
    const d = await dialog()
    await userEvent.click(within(d).getByRole('button', { name: 'Assign' }))
    await userEvent.click(within(d).getByText('Maya'))
    await userEvent.click(within(d).getByText('Leo'))
    expect(within(d).getByText(/own copy and their own points/)).toBeInTheDocument()
    await userEvent.click(within(d).getByText('Race'))
    expect(within(d).getByText(/first kid to finish/)).toBeInTheDocument()
    await userEvent.click(within(d).getByText('Team'))
    expect(within(d).getByText(/split evenly/)).toBeInTheDocument()
  })

  test('One time needs a date before Save is enabled', async () => {
    await open()
    await userEvent.click(screen.getByText('Unassigned'))
    const d = await dialog()
    await userEvent.click(within(d).getByRole('button', { name: 'Assign' }))
    await userEvent.click(within(d).getByText('Maya'))
    await userEvent.click(within(d).getByText('One time'))
    const save = within(d).getByRole('button', { name: 'Save' })
    expect(save).toBeDisabled()
    fireEvent.change(within(d).getByLabelText('Date'), { target: { value: '2026-11-01' } })
    expect(save).toBeEnabled()
    await userEvent.click(save)
    await waitFor(() => expect(calls('POST')[0][1]?.body).toMatchObject({ repeat: { type: 'once', days: [] }, on_date: '2026-11-01' }))
  })

  test('editing an assignment PATCHes it; removing DELETEs it', async () => {
    await open()
    await userEvent.click(screen.getByText('Clean room'))
    const d = await dialog()
    await userEvent.click(within(d).getByRole('button', { name: /Maya/ }))
    await userEvent.click(within(d).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(calls('PATCH')[0][0]).toBe('/assignments/11'))
    await userEvent.click(await within(d).findByRole('button', { name: /Maya/ }))
    await userEvent.click(within(d).getByRole('button', { name: 'Remove' }))
    const confirm = await screen.findByRole('dialog', { name: 'Remove this assignment?' })
    await userEvent.click(within(confirm).getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(calls('DELETE')[0]).toEqual(['/assignments/11', { method: 'DELETE' }]))
  })

  test('Copy POSTs /copy and opens the copy', async () => {
    await open()
    await userEvent.click(screen.getByText('Clean room'))
    const d = await dialog()
    await userEvent.click(within(d).getByRole('button', { name: 'Copy' }))
    await waitFor(() => expect(calls('POST')[0]).toEqual(['/chores/5/copy', { method: 'POST' }]))
  })

  test('Delete asks first, says history stays, then DELETEs and toasts', async () => {
    await open()
    await userEvent.click(screen.getByText('Clean room'))
    const d = await dialog()
    await userEvent.click(within(d).getByRole('button', { name: 'Delete' }))
    expect(calls('DELETE')).toHaveLength(0)
    const confirm = await screen.findByRole('dialog', { name: 'Delete Clean room?' })
    expect(within(confirm).getByText('Chores already done stay in history.')).toBeInTheDocument()
    await userEvent.click(within(confirm).getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(calls('DELETE')[0]).toEqual(['/chores/5', { method: 'DELETE' }]))
  })
})
