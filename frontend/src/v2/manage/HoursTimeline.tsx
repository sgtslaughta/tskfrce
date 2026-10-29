import { Icon } from '@/v2/parent/Icon'
import type { Group, HourRule, Kid } from '@/v2/types'
import { initial, nameOf } from './choreMeta'
import { datesLabel, daysLabel, rangeLabel, ruleTexture, segments, sortRules, whoLabel } from './hoursMeta'

interface Props {
  rules: HourRule[]
  kids: Kid[]
  groups: Group[]
  onEdit?: (r: HourRule) => void
  /** Shown inside one group's page: a rule that targets only groups reads "only this group". */
  thisGroup?: boolean
}

// keep "Dec 20" together so a narrow name column only wraps at the dash
const when = (r: HourRule) =>
  r.start_date && r.end_date ? datesLabel(r.start_date, r.end_date).replace(/([A-Z][a-z]{2}) (\d)/g, '$1\u00a0$2') : daysLabel(r.days)

/** Pattern timeline (mockup 02 Settings → Hours): one row per rule, bars per time over a 24 h track. */
export function HoursTimeline({ rules, kids, groups, onEdit, thisGroup }: Props) {
  if (!rules.length)
    return <p className="ph-empty">{thisGroup ? "No hours just for this group. Each kid's own hours still apply." : 'No hours yet. Devices can be online any time until you add some.'}</p>
  return (
    <div className="ph-tl" data-edit={!!onEdit}>
      {sortRules(rules).map((r) => {
        const tex = ruleTexture(r)
        const kid = r.kid_ids.length === 1 ? kids.find((k) => k.id === r.kid_ids[0]) : undefined
        return (
          <div key={r.id} className="ph-row">
            <div className="ph-nm">
              <span className={`sq pt ${tex}`} aria-hidden="true" />
              {kid && <span className="avx" aria-hidden="true">{initial(nameOf(kid))}</span>}
              <div className="ph-nm-t">
                {r.name}
                <small>{`${thisGroup && !r.everyone && !r.kid_ids.length ? 'only this group' : whoLabel(r, kids, groups)} · ${when(r)}`}</small>
              </div>
            </div>
            <div className="ph-tr">
              {r.times.flatMap((t, i) =>
                segments(t.start, t.end).map(([from, to], j) => (
                  <b key={`${i}-${j}`} className={r.kind === 'allowed' ? `pt ${tex}` : undefined} data-kind={r.kind} data-edge={to >= 100 && from > 0 ? 'r' : from <= 0 && to < 100 ? 'l' : undefined} style={{ left: `${from}%`, width: `${to - from}%` }}>
                    {j === 0 && <em>{rangeLabel(t.start, t.end)}</em>}
                  </b>
                )),
              )}
            </div>
            {onEdit && (
              <button type="button" className="ph-ed" aria-label={`Edit ${r.name}`} title="Edit" onClick={() => onEdit(r)}>
                <Icon name="edit" size={15} />
              </button>
            )}
          </div>
        )
      })}
      <div className="ph-ax" aria-hidden="true">
        {['12a', '6a', '12p', '6p', '12a'].map((t, i) => (
          <span key={i}>{t}</span>
        ))}
      </div>
    </div>
  )
}
