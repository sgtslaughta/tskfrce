import { useRef } from 'react'
import type { UseMutationResult } from '@tanstack/react-query'

/**
 * `mutate` that ignores calls while the previous one is still running. React Query only reports
 * isPending on the next tick, so a fast double-click or Enter-mash would otherwise send twice.
 * Callbacks run off the promise, so they still fire when the caller unmounts on the refetch
 * (per-call `mutate` callbacks are dropped then).
 */
export function useSingle<R, E, V>(m: UseMutationResult<R, E, V, unknown>) {
  const busy = useRef(false)
  return (vars: V, opts?: { onSuccess?: (r: R, vars: V) => void; onError?: (e: E, vars: V) => void }) => {
    if (busy.current) return
    busy.current = true
    m.mutateAsync(vars)
      .then(
        (r) => opts?.onSuccess?.(r, vars),
        (e: E) => opts?.onError?.(e, vars),
      )
      .finally(() => {
        busy.current = false
      })
  }
}
