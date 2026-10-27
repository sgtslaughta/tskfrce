import { expect, test } from '@jest/globals'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BlockerBanner } from '@/v2/components/BlockerBanner'

jest.mock('@/v2/hooks/useDevices', () => ({ useBlocker: () => ({ data: { online: false, last_seen: null } }) }))

test('box offline shows the red banner; Details explains, Dismiss hides it', async () => {
  const { QueryClient, QueryClientProvider } = jest.requireActual('@tanstack/react-query')
  render(
    <QueryClientProvider client={new QueryClient()}>
      <BlockerBanner />
    </QueryClientProvider>,
  )
  expect(screen.getByText('Home box offline')).toBeInTheDocument()
  expect(screen.queryByText(/hasn’t checked in yet/)).toBeNull()
  await userEvent.click(screen.getByRole('button', { name: 'Details' }))
  expect(screen.getByText(/hasn’t checked in yet/)).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
  expect(screen.queryByText('Home box offline')).toBeNull()
})

test('a request that cannot reach the box shows the offline banner until one succeeds', async () => {
  const { QueryClient, QueryClientProvider, useQuery } = jest.requireActual('@tanstack/react-query')
  const { ApiError } = jest.requireActual('@/v2/api')
  const { act } = jest.requireActual('@testing-library/react')
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  let fail = true
  const Probe = () => {
    useQuery({ queryKey: ['p'], queryFn: async () => { if (fail) throw new ApiError(502, 'down'); return 1 } })
    return null
  }
  render(
    <QueryClientProvider client={qc}>
      <Probe />
      <BlockerBanner />
    </QueryClientProvider>,
  )
  expect(await screen.findByText("Can't reach your home box")).toBeInTheDocument()
  fail = false
  await act(() => qc.refetchQueries({ queryKey: ['p'] }))
  expect(screen.queryByText("Can't reach your home box")).toBeNull()
})
