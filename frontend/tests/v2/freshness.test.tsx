import { afterEach, describe, expect, jest, test } from '@jest/globals'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { agoText, startingUp, summarize, type QState } from '@/v2/parent/freshness'
import { Freshness } from '@/v2/parent/Freshness'
import { openingLabel } from '@/v2/today/openingLabel'

const q = (over: Partial<QState> = {}): QState => ({ status: 'success', fetchStatus: 'idle', data: {}, error: null, dataUpdatedAt: 1000, ...over })

describe('summarize', () => {
  test('quiet when nothing is refreshing', () => {
    expect(summarize([q()])).toEqual({ updating: false, since: 0, failed: false })
  })
  test('updating only counts queries that already have data, oldest first', () => {
    expect(summarize([q({ fetchStatus: 'fetching', dataUpdatedAt: 500 }), q({ fetchStatus: 'fetching', dataUpdatedAt: 900 })])).toMatchObject({ updating: true, since: 500 })
    expect(summarize([q({ fetchStatus: 'fetching', data: undefined, status: 'pending' })]).updating).toBe(false)
  })
  test('failed = refetch error over cached data, but not when the box is simply unreachable', () => {
    expect(summarize([q({ status: 'error', error: { status: 500 } })]).failed).toBe(true)
    expect(summarize([q({ status: 'error', error: { status: 500 }, data: undefined })]).failed).toBe(false)
    expect(summarize([q({ status: 'error', error: new TypeError('x') })]).failed).toBe(false)
  })
})

test.each([
  [1000, 'just now'],
  [12_000, '12s ago'],
  [180_000, '3m ago'],
  [7_300_000, '2h ago'],
])('agoText %i', (ms, text) => expect(agoText(ms)).toBe(text))

describe('startingUp', () => {
  test('a gateway error soon after open means the box is booting', () => {
    expect(startingUp({ status: 502 }, 1000)).toBe(true)
    expect(startingUp({ status: 503 }, 1000)).toBe(true)
  })
  test('not for other errors, and not after the wait is over', () => {
    expect(startingUp({ status: 500 }, 1000)).toBe(false)
    expect(startingUp(new TypeError('x'), 1000)).toBe(false)
    expect(startingUp({ status: 502 }, 4 * 60_000)).toBe(false)
  })
})

test('openingLabel names the chore and the kids', () => {
  const kids = [{ id: 1, full_name: 'Mia', username: 'mia' }, { id: 2, full_name: null, username: 'sam' }]
  expect(openingLabel('Homework', [1], kids)).toBe('Homework · Mia')
  expect(openingLabel('Homework', [1, 2], kids)).toBe('Homework · Mia and sam')
  expect(openingLabel('Homework', [1])).toBe('Homework')
})

describe('Freshness line', () => {
  afterEach(() => jest.useRealTimers())
  const setup = () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={qc}>
        <Freshness />
      </QueryClientProvider>,
    )
    return qc
  }
  const observe = (qc: QueryClient, key: string, fn: () => Promise<unknown>) => {
    const o = qc.getQueryCache().build(qc, { queryKey: [key], queryFn: fn })
    o.addObserver({ onQueryUpdate() {}, options: {} } as never)
    return o
  }

  test('stays quiet while the device is offline (the offline banner wins)', async () => {
    const spy = jest.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(false)
    const qc = setup()
    const query = observe(qc, 'bad', () => Promise.reject({ status: 500 }))
    query.setData({ ok: 1 })
    await act(async () => void (await query.fetch().catch(() => undefined)))
    expect(screen.queryByRole('alert')).toBeNull()
    spy.mockReturnValue(true)
    act(() => void window.dispatchEvent(new Event('online')))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/Couldn.t update/))
    spy.mockRestore()
  })

  test('shows Updating… with last-updated after a short delay while cached data refetches', async () => {
    jest.useFakeTimers()
    const qc = setup()
    let release: (v: unknown) => void = () => {}
    const query = observe(qc, 'today', () => new Promise((r) => (release = r)))
    query.setData({ ok: 1 })
    act(() => void query.fetch())
    act(() => void jest.advanceTimersByTime(1)) // cache events are applied on the next tick
    expect(screen.queryByRole('status')).toBeNull() // quick polls don't flash
    act(() => void jest.advanceTimersByTime(800))
    expect(screen.getByRole('status')).toHaveTextContent(/Updating… last updated/)
    await act(async () => release({ ok: 2 }))
    act(() => void jest.advanceTimersByTime(1))
    expect(screen.queryByRole('status')).toBeNull()
  })

  test('shows the Update failed banner with a working Retry when a refetch fails over cached data', async () => {
    const qc = setup()
    let fail = true
    const query = observe(qc, 'today', async () => {
      if (fail) throw Object.assign(new Error('boom'), { status: 500 })
      return { ok: 3 }
    })
    query.setData({ ok: 1 })
    await act(async () => void (await query.fetch().catch(() => {})))
    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't update")
    fail = false
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull())
  })
})
