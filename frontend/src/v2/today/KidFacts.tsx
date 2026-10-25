import type { TodayKid } from '../types'
import { useClock } from './useClock'

export const initial = (name: string | null) => (name?.trim()[0] ?? '?').toUpperCase()

/** Schedule end time; "Locked" when the kid's devices are already off. */
const locksAt = (kid: TodayKid, clock: (iso: string) => string) => {
  if (kid.locks_at) return clock(kid.locks_at)
  return kid.devices.length && !kid.devices.some((d) => d.online) ? 'Locked' : '—'
}

/** Points / streak / next reward / locks-at, shared by the desktop kid card and phone Today. */
export function KidFacts({ kid }: { kid: TodayKid }) {
  const clock = useClock()
  return (
    <div className="p-kid-facts">
      <div>
        <span>Points</span>
        <b>{kid.points ?? 0}</b>
      </div>
      <div>
        <span>Streak</span>
        <b>{kid.progress?.streak ?? 0} days</b>
      </div>
      <div>
        <span>Next reward</span>
        <b>{kid.next_reward != null ? `${kid.next_reward} pts` : '—'}</b>
      </div>
      <div>
        <span>Locks at</span>
        <b>{locksAt(kid, clock)}</b>
      </div>
    </div>
  )
}
