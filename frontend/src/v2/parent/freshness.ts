import { isUnreachable } from '../hooks/useReachable'

/** The slice of a react-query query state the freshness line needs. */
export interface QState {
  status: string
  fetchStatus: string
  data: unknown
  error: unknown
  dataUpdatedAt: number
}

export interface Freshness {
  /** a refetch is running over data already on screen */
  updating: boolean
  /** oldest data among the queries being refreshed (ms epoch) */
  since: number
  /** a refetch failed while old data is still shown (box-down is the offline banner's job) */
  failed: boolean
}

/** Summarise active queries into the mockup-05 "Updating…" / "Update failed" states. */
export function summarize(states: QState[]): Freshness {
  const shown = states.filter((s) => s.data !== undefined)
  const busy = shown.filter((s) => s.fetchStatus === 'fetching')
  return {
    updating: busy.length > 0,
    since: busy.length ? Math.min(...busy.map((s) => s.dataUpdatedAt)) : 0,
    failed: shown.some((s) => s.status === 'error' && s.fetchStatus !== 'fetching' && !isUnreachable(s.error)),
  }
}

/** "just now", "12s ago", "3m ago", "2h ago". */
export function agoText(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  if (s < 5) return 'just now'
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  return `${Math.floor(s / 3600)}h ago`
}

const GATEWAY = [502, 503, 504]
export const START_WINDOW_MS = 3 * 60_000

/** The box is most likely still booting: the proxy answered, the backend behind it didn't (yet). */
export function startingUp(error: unknown, sinceMs: number): boolean {
  const status = (error as { status?: unknown } | null)?.status
  return typeof status === 'number' && GATEWAY.includes(status) && sinceMs < START_WINDOW_MS
}
