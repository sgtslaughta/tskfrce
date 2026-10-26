import { Icon } from '@/v2/parent/Icon'
import type { KidToday } from '../../types'
import { tally } from '../kidChips'

const plural = (n: number) => (n === 1 ? 'chore' : 'chores')

/** Lock status with one progress dot per chore (10 .status). big = Kid mode, strip = phone. */
export function StatusBanner({ d, size }: { d: KidToday; size: 'big' | 'strip' }) {
  const t = tally(d.chores)
  const title = d.locked ? 'Internet is paused' : 'Internet is on'
  let sub: string
  if (d.locked) sub = t.left ? `Finish ${t.left} more ${plural(t.left)} to turn it on` : 'It comes back on in your allowed hours.'
  else sub = t.left ? `${t.left} ${plural(t.left)} left today` : 'All done for today. Nice work!'
  const live = d.chores.filter((c) => c.state !== 'skipped').slice(0, 10)
  return (
    <div className="k-status" data-size={size} data-open={!d.locked || undefined} role="status">
      <span className="k-status-big">
        <Icon name={d.locked ? 'lock' : 'wifi'} fill />
      </span>
      <div>
        <div className="k-status-t">{title}</div>
        <div className="k-status-s">{sub}</div>
      </div>
      {live.length > 0 && (
        <div className="k-dots" role="img" aria-label={`${t.approved} of ${t.total} done`}>
          {live.map((c, i) => (
            <i key={c.id} data-ok={i < t.approved || undefined}>
              {i < t.approved && <Icon name="check" />}
            </i>
          ))}
        </div>
      )}
    </div>
  )
}
