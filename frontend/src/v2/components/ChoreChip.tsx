import type { ChoreState } from '../types'

const LOOK: Record<ChoreState, { mark: string; label: string }> = {
  done: { mark: '✓', label: 'Done' },
  needs_you: { mark: '!', label: 'Needs you' },
  todo: { mark: '', label: 'To do' },
}

/** One square per chore: ✓ done, ! needs you, blank to do. */
export function ChoreChip({ state }: { state: ChoreState }) {
  const { mark, label } = LOOK[state]
  return (
    <span className="f-chip" data-state={state} role="img" aria-label={label} title={label}>
      {mark}
    </span>
  )
}
