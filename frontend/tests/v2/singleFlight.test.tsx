import { act, renderHook } from '@testing-library/react'
import { useSingleFlight } from '@/v2/hooks/useSingleFlight'

describe('useSingleFlight', () => {
  it('runs one request for a double trigger and allows the next after it settles', async () => {
    const { result } = renderHook(() => useSingleFlight())
    let release!: () => void
    const run = jest.fn(() => new Promise<void>((r) => (release = r)))
    await act(async () => {
      void result.current(run)
      void result.current(run) // second click lands before the first settles
    })
    expect(run).toHaveBeenCalledTimes(1)
    await act(async () => release())
    await act(async () => {
      void result.current(run)
    })
    expect(run).toHaveBeenCalledTimes(2)
  })

  it('frees the guard when the request fails', async () => {
    const { result } = renderHook(() => useSingleFlight())
    const bad = jest.fn(() => Promise.reject(new Error('500')))
    await act(async () => {
      await result.current(bad).catch(() => {})
    })
    const ok = jest.fn(() => Promise.resolve())
    await act(async () => {
      await result.current(ok)
    })
    expect(ok).toHaveBeenCalledTimes(1)
  })
})
