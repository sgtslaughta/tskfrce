import { beforeEach, describe, expect, test } from '@jest/globals'
import type { Mock } from 'jest-mock'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MantineProvider } from '@mantine/core'
import { api } from '@/v2/api'
import * as dock from '@/v2/chat/dock'
import { ChoreOpen } from '@/v2/today/ChoreOpen'
import type { RunDetail, TodayChore, TodayKid } from '@/v2/types'

jest.mock('@/v2/api', () => ({ api: jest.fn() }))
jest.mock('@mantine/notifications', () => ({ notifications: { show: jest.fn() } }))
// openChat stays real (the open chore claims it) but records its calls
jest.mock('@/v2/chat/dock', () => {
  const real = jest.requireActual<typeof import('@/v2/chat/dock')>('@/v2/chat/dock')
  return { ...real, openChat: jest.fn(real.openChat) }
})
jest.mock('@/contexts/UnifiedAuthContext', () => ({ useUnifiedAuth: () => ({ user: { id: 1 } }) }))

const apiMock = api as unknown as Mock<(p: string, i?: { method?: string; body?: unknown }) => Promise<unknown>>
const kid = { id: 1, name: 'Mia', chores: [], devices: [] } as unknown as TodayKid
const chore: TodayChore = { id: 11, title: 'Tidy room', points: 25, state: 'todo', can_move: true }
const run = (over: Partial<RunDetail> = {}): RunDetail => ({
  id: 11,
  title: 'Tidy room',
  points: 25,
  state: 'todo',
  due_time: null,
  kid_ids: [1],
  due_at: null,
  type: { id: 1, name: 'Cleaning', glyph: 'cleaning_services' },
  sent_back: false,
  note: null,
  can_move: true,
  photos: [],
  steps: [
    { id: 7, title: 'Make bed', done: false, due_time: '17:00', due_at: '2020-01-01T17:00:00Z', after_previous: false, locked: false },
    { id: 8, title: 'Desk cleared', done: false, due_time: null, due_at: null, after_previous: true, locked: true },
  ],
  ...over,
})

let detail = run()
beforeEach(() => {
  detail = run()
  apiMock.mockReset().mockImplementation(async (p) => {
    if (p === '/chores/11') return detail
    if (p === '/today') return { kids: [{ id: 1, name: 'Mia', chores: [] }, { id: 2, name: 'Leo', chores: [] }] }
    if (p === '/chat/threads/chore/11') return { id: 5, kind: 'chore', title: 'Tidy room', messages: [], has_more: false }
    if (p.startsWith('/chat/threads')) return { total: 0, threads: [] }
    return { timezone: 'UTC' }
  })
})

const open = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MantineProvider>
        <ChoreOpen chore={chore} kid={kid} />
      </MantineProvider>
    </QueryClientProvider>,
  )

describe('ChoreOpen', () => {
  test('late step shows Late and a chained step its badge', async () => {
    open()
    expect(await screen.findByText('Late')).toBeInTheDocument()
    expect(screen.getByText('After the step above')).toBeInTheDocument()
  })

  test('step Reply calls openChat with the step id', async () => {
    open()
    await userEvent.click(await screen.findByRole('button', { name: 'Reply on Make bed' }))
    expect(dock.openChat).toHaveBeenCalledWith('chore', '11', { step_id: 7, label: 'Make bed' })
  })

  test('step reply opens the chat beside the chore and sends step_id', async () => {
    open()
    await userEvent.click(await screen.findByRole('button', { name: 'Reply on Make bed' }))
    expect(await screen.findByTestId('chat-column')).toBeInTheDocument()
    expect(screen.getByTestId('replying')).toHaveTextContent('Replying to Make bed')
    expect(screen.getByLabelText('Message')).toHaveAttribute('placeholder', 'Reply…')
    await userEvent.type(await screen.findByLabelText('Message'), 'Corners too{Enter}')
    await waitFor(() =>
      expect(apiMock).toHaveBeenCalledWith('/chat/threads/5/messages', {
        method: 'POST',
        body: { body: 'Corners too', photo_id: null, step_id: 7 },
        kid: false,
      }),
    )
  })

  test('Deduct with the −10 preset posts kid, amount and reason', async () => {
    open()
    await userEvent.click(await screen.findByRole('button', { name: /deduct points/i }))
    expect(screen.getByRole('group', { name: 'Amount' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '−10' }))
    await userEvent.type(screen.getByLabelText('Reason'), 'Left plates')
    await userEvent.click(screen.getByRole('button', { name: /^deduct$/i }))
    await waitFor(() =>
      expect(apiMock).toHaveBeenCalledWith('/chores/11/deduct', { method: 'POST', body: { kid_id: 1, amount: 10, note: 'Left plates' } }),
    )
  })

  test('shared chore asks which kid; Custom takes a typed amount', async () => {
    detail = run({ kid_ids: [1, 2] })
    open()
    await userEvent.click(await screen.findByRole('button', { name: /deduct points/i }))
    await userEvent.click(await screen.findByRole('button', { name: 'Leo' }))
    await userEvent.click(screen.getByRole('button', { name: 'Custom' }))
    await userEvent.type(screen.getByLabelText('Custom amount'), '7')
    await userEvent.type(screen.getByLabelText('Reason'), 'Rude')
    await userEvent.click(screen.getByRole('button', { name: /^deduct$/i }))
    await waitFor(() =>
      expect(apiMock).toHaveBeenCalledWith('/chores/11/deduct', { method: 'POST', body: { kid_id: 2, amount: 7, note: 'Rude' } }),
    )
  })

  test('skipped chore offers Undo skip and no Deduct', async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MantineProvider>
          <ChoreOpen chore={{ ...chore, state: 'skipped' }} kid={kid} />
        </MantineProvider>
      </QueryClientProvider>,
    )
    await userEvent.click(await screen.findByRole('button', { name: /undo skip/i }))
    expect(screen.queryByRole('button', { name: /deduct points/i })).toBeNull()
    await waitFor(() => expect(apiMock).toHaveBeenCalledWith('/chores/11/undo', { method: 'POST' }))
  })
})
