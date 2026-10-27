import type { QueryClient } from '@tanstack/react-query'
import { api } from '../api'
import { STEP_KEY } from '../components/RequireParent'

export const LAST = 7
/** The account exists from step 2 on, so the server only remembers steps from 3. */
export const FIRST_SAVED = 3

/** What the server should remember after the wizard lands on step `n` (null = finished). */
export const savedStep = (n: number): number | null => (n > LAST ? null : n)

/** Tell the server (fire and forget) which step to resume at; the guard reads it from the same cache key. */
export function saveStep(qc: QueryClient, n: number): void {
  if (n < FIRST_SAVED) return
  const step = savedStep(n)
  void api('/setup/step', { method: 'PUT', body: { step } })
    .then(() => qc.setQueryData(STEP_KEY, { step }))
    .catch(() => {}) // losing a save only costs a resume; the wizard itself carries on
}
