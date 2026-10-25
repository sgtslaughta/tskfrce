import { useRef } from 'react'

/**
 * Lets one request run at a time. A double click or an Enter-mash lands before React
 * re-renders the "busy" state, so `isPending` alone can't stop the second request.
 * Pass `onSettled` to the mutation so the next request can go.
 */
export function useSingleFlight() {
  const busy = useRef(false)
  return (run: (settled: { onSettled: () => void }) => void) => {
    if (busy.current) return
    busy.current = true
    run({ onSettled: () => (busy.current = false) })
  }
}
