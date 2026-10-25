import type { TodayKid } from '../types'

export const initial = (name: string | null) => (name?.trim()[0] ?? '?').toUpperCase()
const clock = (iso: string) => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })

/** Schedule end time; "Locked" when the kid's devices are already off. */
const locksAt = (kid: TodayKid) => {
  if (kid.locks_at) return clock(kid.locks_at)
  return kid.devices.length && !kid.devices.some((d) => d.online) ? 'Locked' : '—'
}

/** Points / streak / next reward / locks-at, shared by the desktop kid card and phone Today. */
export function KidFacts({ kid }: { kid: TodayKid }) {
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
        <b>{locksAt(kid)}</b>
      </div>
    </div>
  )
}
