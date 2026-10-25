import { beforeEach, expect, test } from '@jest/globals'
import type { Mock } from 'jest-mock'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MantineProvider } from '@mantine/core'
import { api } from '@/v2/api'
import { NeedsYouList } from '@/v2/today/NeedsYouList'
import type { NeedsItem } from '@/v2/types'

jest.mock('@/v2/api', () => ({ api: jest.fn() }))
jest.mock('@mantine/notifications', () => ({ notifications: { show: jest.fn() } }))
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
