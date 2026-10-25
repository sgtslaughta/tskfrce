import { useCallback, useRef } from 'react'

/** Runs `fn` unless a previous run is still going. A ref, not isPending: a double-click or Enter-mash
 *  lands before React re-renders, so state-based guards let a second request through. */
export function useSingleFlight() {
  const busy = useRef(false)
  return useCallback(async (fn: () => Promise<unknown>) => {
    if (busy.current) return
    busy.current = true
    try {
      await fn()
    } finally {
      busy.current = false
    }
  }, [])
}
