import type { Device } from '@/v2/types'
import { clockText } from '@/v2/clockText'

interface Props {
  members: Device[]
  timeZone?: string
}

/** Summary strip under a group's cards (mockup 02 Groups). */
export function GroupStats({ members, timeZone }: Props) {
  const alerts = members.reduce((n, d) => n + (d.alerts ?? 0), 0)
  const overrides = members.filter((d) => d.override).length
  const next = members.map((d) => d.locks_at).filter((t): t is string => !!t).sort()[0]
  const cells: [string, string, boolean?][] = [
    ['Online now', `${members.filter((d) => d.seen_now).length} of ${members.length}`],
    ['Alerts · 7 days', String(alerts), alerts > 0],
    ['Overrides today', String(overrides)],
    ['Next lock', next ? clockText(next, timeZone) : '—'],
  ]
  return (
    <div className="pk-sumbar" role="group" aria-label="Group summary">
      {cells.map(([label, value, hi]) => (
        <div key={label}>
          <span>{label}</span>
          <b data-hi={hi || undefined}>{value}</b>
        </div>
      ))}
    </div>
  )
}
