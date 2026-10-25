import { useRef } from 'react'
import type { MutateOptions, UseMutationResult } from '@tanstack/react-query'

/**
 * `mutate` that ignores calls while the previous one is still running. React Query only reports
 * isPending on the next tick, so a fast double-click or Enter-mash would otherwise send twice.
 */
export function useSingle<R, E, V>(m: UseMutationResult<R, E, V, unknown>) {
  const busy = useRef(false)
  return (vars: V, opts?: MutateOptions<R, E, V, unknown>) => {
    if (busy.current) return
    busy.current = true
    m.mutate(vars, {
      ...opts,
      onSettled: (...a) => {
        busy.current = false
        opts?.onSettled?.(...a)
      },
    })
  }
}
