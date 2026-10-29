import { expect, test } from '@jest/globals'
import { act, render } from '@testing-library/react'
import { notifications } from '@mantine/notifications'
import { BlockerBanner } from '@/v2/components/BlockerBanner'

jest.mock('@mantine/notifications', () => ({ notifications: { show: jest.fn(), hide: jest.fn() } }))
let blocker: { online: boolean; last_seen: string | null } = { online: false, last_seen: null }
jest.mock('@/v2/hooks/useDevices', () => ({ useBlocker: () => ({ data: blocker }) }))

type Shown = { id: string; title: string; color: string; message: string; autoClose: boolean; onClose: () => void }
const shown = () => (notifications.show as unknown as { mock: { calls: [Shown][] } }).mock.calls.map((c) => c[0])

const { QueryClient, QueryClientProvider } = jest.requireActual('@tanstack/react-query')
const mount = (qc = new QueryClient(), extra: React.ReactNode = null) =>
  render(
    <QueryClientProvider client={qc}>
      {extra}
      <BlockerBanner />
    </QueryClientProvider>,
  )

beforeEach(() => jest.clearAllMocks())

test('box offline is one sticky red toast; dismissing it keeps it closed for that outage', () => {
  blocker = { online: false, last_seen: null }
  const view = mount()
  expect(shown()).toHaveLength(1)
  const t = shown()[0]
  expect(t).toMatchObject({ title: 'Home box offline', color: 'fridgeRed', autoClose: false })
  expect(t.message).toMatch(/hasn't checked in yet/)
  act(() => t.onClose())
  view.unmount()
  mount().unmount()
  expect(shown()).toHaveLength(1) // same outage: not shown again
})

test('a request that cannot reach the box shows an amber toast until one succeeds', async () => {
  blocker = { online: true, last_seen: null }
  const { useQuery } = jest.requireActual('@tanstack/react-query')
  const { ApiError } = jest.requireActual('@/v2/api')
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  let fail = true
  const Probe = () => {
    useQuery({ queryKey: ['p'], queryFn: async () => { if (fail) throw new ApiError(502, 'down'); return 1 } })
    return null
  }
  const view = mount(qc, <Probe />)
  await act(() => qc.refetchQueries({ queryKey: ['p'] }).catch(() => {}))
  expect(shown().at(-1)).toMatchObject({ title: "Can't reach your home box", color: 'sun' })
  fail = false
  await act(() => qc.refetchQueries({ queryKey: ['p'] }))
  expect(notifications.hide).toHaveBeenCalledWith('box-unreachable')
  view.unmount()
})

test('no network on this device swaps the red toast for an amber one, and clears when back', () => {
  blocker = { online: false, last_seen: '2026-10-28T10:00:00Z' }
  const view = mount()
  expect(shown().at(-1)).toMatchObject({ title: 'Home box offline' })
  const online = jest.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(false)
  act(() => void window.dispatchEvent(new Event('offline')))
  expect(notifications.hide).toHaveBeenCalledWith('box-box')
  expect(shown().at(-1)).toMatchObject({ title: "You're offline", color: 'sun' })
  blocker = { online: true, last_seen: '2026-10-28T10:00:00Z' }
  online.mockReturnValue(true)
  act(() => void window.dispatchEvent(new Event('online')))
  expect(notifications.hide).toHaveBeenCalledWith('box-offline')
  view.unmount()
  online.mockRestore()
})
