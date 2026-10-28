import { beforeEach, expect, test } from '@jest/globals'
import type { Mock } from 'jest-mock'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MantineProvider } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { api } from '@/v2/api'
import { NeedsYouList } from '@/v2/today/NeedsYouList'
import type { NeedsItem } from '@/v2/types'
import { openChat } from '@/v2/chat/dock'

jest.mock('@/v2/api', () => ({ api: jest.fn() }))
jest.mock('@mantine/notifications', () => ({ notifications: { show: jest.fn() } }))
const push = jest.fn()
jest.mock('next/router', () => ({ useRouter: () => ({ push }) }))
jest.mock('@/v2/chat/dock', () => ({ openChat: jest.fn() }))
const apiMock = api as unknown as Mock<(p: string, init?: object) => Promise<unknown>>

const chore: NeedsItem = { type: 'chore', id: 11, kid_id: 1, kid_name: 'Mia', title: 'Dishes', attempt: 2, submitted_at: '2026-10-24T20:00:00Z' }
const reward: NeedsItem = { type: 'reward', id: 11, kid_id: 1, kid_name: 'Mia', title: 'Ice cream', cost: 40, kid_balance: 60 }

beforeEach(() => apiMock.mockReset().mockResolvedValue({}))

const show = (items: NeedsItem[]) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MantineProvider>
        <NeedsYouList items={items} />
      </MantineProvider>
    </QueryClientProvider>,
  )
const card = (title: string) => screen.getByText(title).closest('.p-needs-item') as HTMLElement

test('reward approve and decline go to the redemption, never the chore with the same id', async () => {
  show([chore, reward])
  await userEvent.click(within(card('Ice cream')).getByRole('button', { name: 'Approve' }))
  await waitFor(() => expect(apiMock).toHaveBeenCalledWith('/redemptions/11/approve', { method: 'POST' }))
  await userEvent.click(within(card('Ice cream')).getByRole('button', { name: 'Decline' }))
  await waitFor(() => expect(apiMock).toHaveBeenCalledWith('/redemptions/11/deny', { method: 'POST' }))
  expect(apiMock).not.toHaveBeenCalledWith('/chores/11/approve', expect.anything())
})

test('a screen-time request names the device, and still renders without one', () => {
  const t: NeedsItem = { type: 'screen_time', id: 5, kid_id: 1, kid_name: 'Mia', title: '30 min of screen time', cost: 40, kid_balance: 60 }
  show([t, { ...t, id: 6, title: '15 min of screen time', device_name: "Mia's iPad" }])
  expect(card('30 min of screen time')).toHaveTextContent('Mia · 40 pts')
  expect(card('15 min of screen time')).toHaveTextContent("Mia · from Mia's iPad · 40 pts")
})

test('send back needs a note, then posts it', async () => {
  show([chore])
  expect(card('Dishes')).toHaveTextContent('Mia · 2nd try')
  await userEvent.click(within(card('Dishes')).getByRole('button', { name: 'Send back' }))
  const send = within(card('Dishes')).getByRole('button', { name: 'Send back' })
  expect(send).toBeDisabled()
  await userEvent.type(screen.getByLabelText('Note for sending back'), 'Pans too')
  await userEvent.click(send)
  await waitFor(() => expect(apiMock).toHaveBeenCalledWith('/chores/11/send-back', { method: 'POST', body: { note: 'Pans too' } }))
})

test('empty list is all caught up', () => {
  show([])
  expect(screen.getByText('All caught up')).toBeInTheDocument()
})

test('approve all keeps going past a failing item and reports both counts', async () => {
  const a = { ...chore, id: 1, title: 'A' }
  const b = { ...chore, id: 2, title: 'B' }
  const c = { ...chore, id: 3, title: 'C' }
  apiMock.mockImplementation(async (p) => {
    if (p === '/chores/2/approve') throw new Error("This chore isn't waiting for approval.")
    return {}
  })
  show([a, b, c])
  await userEvent.click(screen.getByRole('button', { name: /approve all 3/i }))
  await waitFor(() => expect(apiMock).toHaveBeenCalledWith('/chores/3/approve', { method: 'POST' }))
  expect(apiMock).toHaveBeenCalledWith('/chores/1/approve', { method: 'POST' })
  await waitFor(() =>
    expect(notifications.show).toHaveBeenCalledWith(expect.objectContaining({ title: '1 item not approved', message: "This chore isn't waiting for approval." })),
  )
  expect(notifications.show).toHaveBeenCalledWith(expect.objectContaining({ message: 'Approved 2 items' }))
})

test('double click on Approve sends one request', async () => {
  apiMock.mockImplementation(() => new Promise((r) => setTimeout(() => r({}), 150))) // a real request takes a moment
  show([chore])
  await userEvent.dblClick(within(card('Dishes')).getByRole('button', { name: 'Approve' }))
  await waitFor(() => expect(apiMock).toHaveBeenCalledWith('/chores/11/approve', { method: 'POST' }))
  expect(apiMock.mock.calls.filter(([p]) => p === '/chores/11/approve')).toHaveLength(1)
})

test('a failed send back keeps the note box and its text', async () => {
  apiMock.mockRejectedValue(new Error('nope'))
  show([chore])
  await userEvent.click(within(card('Dishes')).getByRole('button', { name: 'Send back' }))
  await userEvent.type(screen.getByLabelText('Note for sending back'), 'Pans too')
  await userEvent.click(within(card('Dishes')).getByRole('button', { name: 'Send back' }))
  await waitFor(() => expect(notifications.show).toHaveBeenCalledWith(expect.objectContaining({ message: 'nope' })))
  expect(screen.getByLabelText('Note for sending back')).toHaveValue('Pans too')
})

const note: NeedsItem = { type: 'note', id: 21, kid_id: 1, kid_name: 'Mia', title: 'Clean bathroom', note: 'stuck on step 3' }

test('a kid note shows the note and only Reply, which opens the chore thread', async () => {
  show([note])
  expect(card('Clean bathroom')).toHaveTextContent('Mia: stuck on step 3')
  expect(within(card('Clean bathroom')).queryByRole('button', { name: 'Approve' })).toBeNull()
  expect(within(card('Clean bathroom')).queryByRole('button', { name: 'Send back' })).toBeNull()
  await userEvent.click(within(card('Clean bathroom')).getByRole('button', { name: 'Reply' }))
  expect(push).toHaveBeenCalledWith('/?chore=21')
  expect(openChat).toHaveBeenCalledWith('chore', '21')
})

test('a list with only a note is not all caught up', () => {
  show([note])
  expect(screen.queryByText('All caught up')).toBeNull()
})

test('approve all leaves notes out', () => {
  show([chore, { ...chore, id: 12, title: 'Bins' }, note])
  expect(screen.getByRole('button', { name: /approve all 2/i })).toBeInTheDocument()
})

