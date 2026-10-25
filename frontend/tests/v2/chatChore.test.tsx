import { beforeEach, describe, expect, test } from '@jest/globals'
import type { Mock } from 'jest-mock'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MantineProvider } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { api } from '@/v2/api'
import { ThreadView } from '@/v2/chat/ThreadView'

jest.mock('@/v2/api', () => ({ api: jest.fn() }))
jest.mock('@mantine/notifications', () => ({ notifications: { show: jest.fn() } }))
jest.mock('@mantine/hooks', () => ({ ...jest.requireActual('@mantine/hooks'), useMediaQuery: () => true }))
jest.mock('@/contexts/UnifiedAuthContext', () => ({ useUnifiedAuth: () => ({ user: { id: 1 } }) }))

const apiMock = api as unknown as Mock<(p: string, init?: { method?: string; body?: unknown }) => Promise<unknown>>

const run = (state: string) => ({
  id: 41, title: 'Make bed', points: 10, state, due_time: null, kid_ids: [2],
  steps: [
    { id: 1, title: 'Pull sheets', done: true, done_at: '2026-10-24T15:02:00Z' },
    { id: 2, title: 'Fluff pillow', done: false, done_at: null },
  ],
  photos: [],
})
let state = 'needs_you'

beforeEach(() => {
  state = 'needs_you'
  jest.mocked(notifications.show).mockClear()
  apiMock.mockReset().mockImplementation(async (p) => {
    if (p === '/chat/threads') return { total: 0, threads: [] }
    if (p.startsWith('/chat/threads/chore/')) return { id: 9, kind: 'chore', title: 'Make bed · Bobby', messages: [], has_more: false, run_id: 41 }
    if (p === '/chores/41') return run(state)
    if (p === '/today') return { kids: [{ id: 2, name: 'Bobby', done: 3, total: 5, points: 860, chores: [], devices: [] }] }
    return { ok: true }
  })
})

const show = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MantineProvider>
        <ThreadView kind="chore" refId="41" meId={1} />
      </MantineProvider>
    </QueryClientProvider>,
  )
const bodyOf = (path: string) => apiMock.mock.calls.find(([p]) => p === path)?.[1]?.body

describe('chore thread', () => {
  test('side panel shows steps with tick times and the kid today', async () => {
    show()
    expect(await screen.findByText('Pull sheets')).toBeInTheDocument()
    expect(screen.getByText('Fluff pillow')).toBeInTheDocument()
    expect(await screen.findByText('Bobby today')).toBeInTheDocument()
    expect(screen.getByText('3 / 5')).toBeInTheDocument()
    expect(screen.getByText('860')).toBeInTheDocument()
  })

  test('Approve and Send back only when the run needs you; Deduct always', async () => {
    show()
    expect(await screen.findByRole('button', { name: 'Approve' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Send back' })).toBeInTheDocument()
  })

  test('no Approve or Send back once done', async () => {
    state = 'done'
    show()
    expect(await screen.findByRole('button', { name: 'Deduct' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Approve' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Send back' })).toBeNull()
  })

  test('Approve shows the undo toast first', async () => {
    show()
    await userEvent.click(await screen.findByRole('button', { name: 'Approve' }))
    expect(notifications.show).toHaveBeenCalled()
    expect(apiMock).not.toHaveBeenCalledWith('/chores/41/approve', expect.anything())
  })

  test('Send back needs a note, then posts it', async () => {
    show()
    await userEvent.click(await screen.findByRole('button', { name: 'Send back' }))
    const go = screen.getAllByRole('button', { name: 'Send back' }).at(-1)!
    expect(go).toBeDisabled()
    await userEvent.type(screen.getByLabelText('Note for sending back'), 'Fix the pillow')
    await userEvent.click(go)
    await waitFor(() => expect(bodyOf('/chores/41/send-back')).toEqual({ note: 'Fix the pillow' }))
  })

  test('Deduct posts amount and reason for the run kid', async () => {
    show()
    await userEvent.click(await screen.findByRole('button', { name: 'Deduct' }))
    const go = screen.getAllByRole('button', { name: 'Deduct' }).at(-1)!
    expect(go).toBeDisabled()
    await userEvent.click(screen.getByRole('button', { name: '−20' }))
    await userEvent.type(screen.getByLabelText('Reason'), 'Left a mess')
    await userEvent.click(go)
    await waitFor(() => expect(bodyOf('/kids/2/deduct')).toEqual({ amount: 20, note: 'Left a mess' }))
  })
})
