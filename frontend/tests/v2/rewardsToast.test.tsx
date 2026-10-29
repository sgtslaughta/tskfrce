import { expect, test } from '@jest/globals'
import type { Mock } from 'jest-mock'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider, useMutation } from '@tanstack/react-query'
import { MantineProvider } from '@mantine/core'
import { api } from '@/v2/api'
import { toastOk } from '@/v2/notify'
import { RewardsRequests } from '@/v2/manage/RewardsRequests'
import { useSingle } from '@/v2/manage/useSingle'
import { fridgeTheme } from '@/v2/theme'

jest.mock('@/v2/api', () => ({ api: jest.fn() }))
jest.mock('@/v2/notify', () => ({ ...jest.requireActual('@/v2/notify'), toastOk: jest.fn(), toastFail: jest.fn() }))
const apiMock = api as unknown as Mock<(p: string) => Promise<unknown>>

test('Decline toasts even though the card unmounts when the list refetches', async () => {
  let declined = false
  const req = { id: 5, kid_id: 2, kid_name: 'Mia', kind: 'reward', name: 'Movie night', icon: null, minutes: null, cost: 50, created_at: new Date().toISOString(), kid_balance: 80, kid_balance_after: 30, note: null }
  apiMock.mockImplementation(async (p: string) => {
    if (p.endsWith('/deny')) {
      declined = true
      return {}
    }
    if (!p.startsWith('/redemptions')) return []
    if (declined) await new Promise((r) => setTimeout(r, 20)) // refetch lands, then the card unmounts
    return declined ? [] : [req]
  })
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MantineProvider theme={fridgeTheme}>
        <RewardsRequests onHistory={() => {}} />
      </MantineProvider>
    </QueryClientProvider>,
  )
  fireEvent.click(await screen.findByRole('button', { name: /decline/i }))
  await waitFor(() => expect(screen.queryByLabelText(/Movie night for Mia/)).toBeNull())
  await waitFor(() => expect(toastOk).toHaveBeenCalledWith('Declined Movie night'))
})

test('useSingle callbacks still fire when the caller unmounts mid-request', async () => {
  const onSuccess = jest.fn()
  let finish: (() => void) | undefined
  function Host() {
    const m = useMutation({ mutationFn: (_: number) => new Promise<string>((r) => (finish = () => r('ok'))) })
    const run = useSingle(m)
    return <button onClick={() => run(1, { onSuccess })}>go</button>
  }
  const { unmount } = render(
    <QueryClientProvider client={new QueryClient()}>
      <Host />
    </QueryClientProvider>,
  )
  fireEvent.click(screen.getByText('go'))
  await waitFor(() => expect(finish).toBeDefined())
  unmount()
  finish?.()
  await waitFor(() => expect(onSuccess).toHaveBeenCalledWith('ok', 1))
})
