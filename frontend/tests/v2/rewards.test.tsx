import { beforeEach, describe, expect, test } from '@jest/globals'
import type { Mock } from 'jest-mock'
import type { ReactNode } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MantineProvider } from '@mantine/core'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fridgeTheme } from '@/v2/theme'
import { api } from '@/v2/api'
import { RewardsPanel } from '@/v2/manage/RewardsPanel'
import type { PendingRedemption } from '@/v2/types'

jest.mock('@mantine/notifications', () => ({ notifications: { show: jest.fn() } }))
jest.mock('@/v2/api', () => ({ api: jest.fn() }))

const apiMock = api as unknown as Mock<(p: string, init?: { method?: string; body?: unknown }) => Promise<unknown>>
const wrap = (ui: ReactNode) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MantineProvider theme={fridgeTheme}>{ui}</MantineProvider>
  </QueryClientProvider>
)
const calls = (method: string) => apiMock.mock.calls.filter(([, i]) => i?.method === method)

const pending: PendingRedemption = {
  id: 7,
  kid_id: 1,
  kid_name: 'Maya',
  kind: 'reward',
  name: 'Movie night',
  minutes: null,
  cost: 150,
  created_at: '2026-10-21T10:00:00Z',
  kid_balance: 200,
}

function serve(redemptions: PendingRedemption[]) {
  apiMock.mockReset().mockImplementation(async (path) => {
    if (path === '/redemptions') return redemptions
    if (path === '/rewards') return []
    return {}
  })
}

beforeEach(() => serve([pending]))

describe('RewardsPanel', () => {
  test('add posts name, price, icon', async () => {
    render(wrap(<RewardsPanel />))
    await userEvent.click(screen.getByRole('button', { name: 'New reward' }))
    await userEvent.type(await screen.findByLabelText('Reward'), 'Pizza')
    await userEvent.clear(screen.getByLabelText('Price (points)'))
    await userEvent.type(screen.getByLabelText('Price (points)'), '80')
    await userEvent.click(screen.getByRole('button', { name: 'Emoji (optional)' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Pick 🍕' }))
    await userEvent.click(screen.getByRole('button', { name: 'Add reward' }))
    await waitFor(() =>
      expect(calls('POST')[0]).toEqual(['/rewards', { method: 'POST', body: { name: 'Pizza', price: 80, icon: '🍕' } }]),
    )
  })
})
