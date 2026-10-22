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
jest.mock('@/v2/components/FridgeShell', () => ({
  FridgeShell: ({ children }: { children: ReactNode }) => <>{children}</>,
}))
jest.mock('@/v2/components/RequireParent', () => ({
  RequireParent: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

const apiMock = api as unknown as Mock<(p: string, init?: { method?: string; body?: unknown }) => Promise<unknown>>
const calls = (method: string) => apiMock.mock.calls.filter(([, i]) => i?.method === method)

const kids: Kid[] = [
  { id: 7, full_name: 'Maya', username: 'kid-maya', avatar: null, has_pin: false },
  { id: 8, full_name: 'Leo', username: 'kid-leo', avatar: null, has_pin: true },
]
const def = (over = {}) => ({
  id: 5,
  title: 'Clean room',
  points: 15,
  kid_ids: [7],
  mode: 'each',
  repeat: { type: 'daily', days: [] },
  needs_photo: false,
  due_time: '19:00',
  subtasks: ['Fold clothes', 'Make bed'],
  ...over,
})
const defs = [def(), def({ id: 6, title: 'Trash', kid_ids: [7, 8], mode: 'race', subtasks: [] })]

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
    if (path.startsWith('/chores/definitions')) return defs
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

describe('chore editor', () => {
  test('create sends kid_ids, mode, subtasks in order', async () => {
    await open()
    await userEvent.click(screen.getByRole('button', { name: 'New chore' }))
    const d = await dialog()
    await userEvent.type(within(d).getByLabelText('Chore'), 'Laundry')
    await userEvent.click(within(d).getByText('Maya'))
    await userEvent.click(within(d).getByText('Leo'))
    await userEvent.click(within(d).getByText('Race'))
    for (const s of ['Fold clothes', 'Make bed']) {
      await userEvent.type(within(d).getByLabelText('Add a subtask'), `${s}{Enter}`)
    }
    fireEvent.change(within(d).getByLabelText('Due by (optional)'), { target: { value: '17:00' } })
    await userEvent.click(within(d).getByRole('button', { name: 'Save' }))
    await waitFor(() =>
      expect(calls('POST')[0]).toEqual([
        '/chores/',
        {
          method: 'POST',
          body: {
            title: 'Laundry',
            points: 10,
            kid_ids: [7, 8],
            mode: 'race',
            subtasks: ['Fold clothes', 'Make bed'],
            repeat: { type: 'daily', days: [] },
            needs_photo: false,
            due_time: '17:00',
          },
        },
      ]),
    )
  })

  test('mode explanation changes per mode', async () => {
    await open()
    await userEvent.click(screen.getByRole('button', { name: 'New chore' }))
    const d = await dialog()
    await userEvent.click(within(d).getByText('Maya'))
    expect(within(d).queryByText('Race')).toBeNull()
    await userEvent.click(within(d).getByText('Leo'))
    expect(within(d).getByText(/own copy and their own points/)).toBeInTheDocument()
    await userEvent.click(within(d).getByText('Race'))
    expect(within(d).getByText(/first kid to finish/)).toBeInTheDocument()
    await userEvent.click(within(d).getByText('Team'))
    expect(within(d).getByText(/split evenly/)).toBeInTheDocument()
  })

  test('subtask reorder changes the order sent; edit PATCHes the definition', async () => {
    await open()
    await userEvent.click(screen.getByText('Clean room'))
    const d = await dialog()
    await userEvent.click(within(d).getByRole('button', { name: 'Move down Fold clothes' }))
    await userEvent.click(within(d).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(calls('PATCH')).toHaveLength(1))
    const [path, init] = calls('PATCH')[0]
    expect(path).toBe('/chores/5')
    expect(init?.body).toMatchObject({ subtasks: ['Make bed', 'Fold clothes'], kid_ids: [7], due_time: '19:00' })
  })

  test('Copy opens a "(copy)" title and saving POSTs', async () => {
    await open()
    await userEvent.click(screen.getByText('Clean room'))
    const d = await dialog()
    await userEvent.click(within(d).getByRole('button', { name: 'Copy' }))
    await waitFor(() => expect(within(d).getByLabelText('Chore')).toHaveValue('Clean room (copy)'))
    await userEvent.click(within(d).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(calls('POST')).toHaveLength(1))
    expect(calls('PATCH')).toHaveLength(0)
    expect(calls('POST')[0][1]?.body).toMatchObject({ title: 'Clean room (copy)' })
  })

  test('Delete asks first via ConfirmDelete', async () => {
    await open()
    await userEvent.click(screen.getByText('Clean room'))
    const d = await dialog()
    await userEvent.click(within(d).getByRole('button', { name: 'Delete' }))
    expect(calls('DELETE')).toHaveLength(0)
    const confirm = await screen.findByRole('dialog', { name: 'Delete Clean room?' })
    await userEvent.click(within(confirm).getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(calls('DELETE')[0]).toEqual(['/chores/5', { method: 'DELETE' }]))
  })
})
