import { beforeEach, describe, expect, test } from '@jest/globals'
import type { Mock } from 'jest-mock'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MantineProvider } from '@mantine/core'
import { fridgeTheme } from '@/v2/theme'
import { api } from '@/v2/api'
import { TodayPage } from '@/v2/today/TodayPage'
import type { Today, TodayChore } from '@/v2/types'

jest.mock('@/v2/api', () => ({ api: jest.fn() }))
jest.mock('@mantine/notifications', () => ({ notifications: { show: jest.fn() } }))
jest.mock('@/v2/components/FridgeShell', () => ({
  FridgeShell: ({ title, actions, children }: { title: string; actions?: unknown; children: unknown }) => (
    <div>
      <h1>{title as string}</h1>
      {actions as never}
      {children as never}
    </div>
  ),
}))

const apiMock = api as unknown as Mock<(p: string, init?: unknown) => Promise<unknown>>

const chore = (id: number, state: TodayChore['state']): TodayChore => ({ id, title: `Chore ${id}`, points: 5, state })
const base: Today = {
  day: '2026-10-20',
  pending_approvals: 1,
  new_devices: [],
  kids: [
    {
      id: 1,
      name: 'Emma',
      avatar: null,
      online_all: false,
      chores: [chore(11, 'done'), chore(12, 'needs_you')],
      devices: [{ id: 21, name: 'iPad', vendor: 'Apple', online: false }],
    },
    { id: 2, name: 'Leo', avatar: null, online_all: true, chores: [], devices: [] },
  ],
}

let client: QueryClient
function renderPage(data: Today) {
  apiMock.mockImplementation(async (p) => (p === '/today' ? data : { ok: true }))
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MantineProvider theme={fridgeTheme}>
        <TodayPage />
      </MantineProvider>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  apiMock.mockReset()
})

describe('TodayPage', () => {
  test('renders kids, day name and sticker', async () => {
    renderPage(base)
    expect(await screen.findByText('Emma')).toBeInTheDocument()
    expect(screen.getByText('Leo')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Tuesday' })).toBeInTheDocument()
    expect(screen.getByText('1 chore needs you')).toBeInTheDocument()
  })

  test('shows new device banner', async () => {
    renderPage({ ...base, new_devices: [{ id: 9, name: 'Xbox' } as never] })
    const link = await screen.findByRole('link', { name: /Assign it/ })
    expect(link).toHaveAttribute('href', '/devices?focus=9')
    expect(screen.getByText(/New device joined: Xbox/)).toBeInTheDocument()
  })

  test('Approve posts and invalidates today', async () => {
    renderPage(base)
    const spy = jest.spyOn(client, 'invalidateQueries')
    await userEvent.click(await screen.findByRole('button', { name: 'Approve' }))
    await waitFor(() => expect(apiMock).toHaveBeenCalledWith('/chores/12/approve', { method: 'POST' }))
    await waitFor(() => expect(spy).toHaveBeenCalledWith({ queryKey: ['today'] }))
  })

  test('many chips collapse and expand', async () => {
    const kid = {
      ...base.kids[0],
      chores: Array.from({ length: 9 }, (_, i) => chore(i + 1, i < 4 ? 'done' : 'todo')),
      devices: Array.from({ length: 6 }, (_, i) => ({ id: 30 + i, name: `Dev${i}`, vendor: null, online: true })),
    }
    renderPage({ ...base, pending_approvals: 0, kids: [kid] })
    const btn = await screen.findByRole('button', { name: /✓ 4\/9 · \+6 devices/ })
    expect(screen.queryByRole('button', { name: /Dev0/ })).toBeNull()
    await userEvent.click(btn)
    expect(await screen.findByRole('button', { name: /Dev0/ })).toBeInTheDocument()
  })

  test('device menu Unlock for 1 hour posts override', async () => {
    renderPage(base)
    await userEvent.click(await screen.findByRole('button', { name: /iPad/ }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Unlock for 1 hour' }))
    await waitFor(() =>
      expect(apiMock).toHaveBeenCalledWith('/devices/21/override', {
        method: 'POST',
        body: { action: 'unlock', minutes: 60 },
      }),
    )
  })

  test('kid badge menu uses kid override and Back to schedule deletes', async () => {
    renderPage(base)
    await userEvent.click(await screen.findByLabelText('Lock or unlock all of Emma’s devices'))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Back to schedule', hidden: true }))
    await waitFor(() => expect(apiMock).toHaveBeenCalledWith('/kids/1/override', { method: 'DELETE' }))
  })

  test('empty state', async () => {
    renderPage({ ...base, pending_approvals: 0, kids: [] })
    expect(await screen.findByText('Add your first kid to get started.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /kid/i })).toHaveAttribute('href', '/kids')
  })
})
