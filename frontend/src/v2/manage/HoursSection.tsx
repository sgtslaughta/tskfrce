import { useState } from 'react'
import { useFamily, usePatchFamily } from '@/v2/hooks/useFamily'
import { useHours } from '@/v2/hooks/useHours'
import { useKids } from '@/v2/hooks/useKids'
import { useGroups } from '@/v2/hooks/useDevices'
import { Icon } from '@/v2/parent/Icon'
import type { HourRule, RuleBody } from '@/v2/types'
import { HoursTimeline } from './HoursTimeline'
import { RuleEditor } from './RuleEditor'
import { CATEGORIES } from './hoursMeta'
import { toastFail, toastOk } from '../notify'

const LEGEND: [string, string][] = [
  ['pt-school', 'School nights · stripes'],
  ['pt-week', 'Weekends · solid'],
  ['pt-holi', 'Holidays · dots'],
  ['pt-summer', 'Summer · lines'],
  ['pt-kid', 'Per child · crosshatch'],
  ['pt-group', 'Per group · horizontal lines'],
]

type Editing = { rule?: HourRule; initial?: Partial<RuleBody> }

/** Settings → Hours (mockup 02): family schedule timeline, pattern legend, chores rule. */
export function HoursSection() {
  const hours = useHours()
  const kids = useKids().data ?? []
  const groups = useGroups().data ?? []
  const family = useFamily().data
  const patch = usePatchFamily()
  const [editing, setEditing] = useState<Editing>({})
  const [open, setOpen] = useState(false)
  const edit = (e: Editing) => (setEditing(e), setOpen(true))
  const rules = hours.data?.rules ?? []
  const today = CATEGORIES.find((c) => c.key === hours.data?.today)?.label
  const has = (k: HourRule['kind']) => rules.some((r) => r.kind === k)

  return (
    <section className="ph" aria-label="Hours">
      <header className="ph-head">
        <div>
          <h2>Hours</h2>
          <p>When devices may be online. Outside these, they lock.</p>
        </div>
        <div className="pk-actions">
          <button type="button" className="p-btn" onClick={() => edit({ initial: { category: 'holiday' } })}>
            <Icon name="event" />
            Add holiday
          </button>
          <button type="button" className="p-btn" data-variant="accent" onClick={() => edit({ initial: { category: 'other' } })}>
            <Icon name="add" />
            Add window
          </button>
        </div>
      </header>

      <div className="pk-panel">
        <h3>
          <Icon name="calendar_month" size={18} />
          Family schedule
          {today && (
            <span className="ph-today">
              Today: <b>{today}</b>
            </span>
          )}
        </h3>
        {hours.isError ? (
          <p className="pk-error">Couldn&apos;t load hours. Refresh to try again.</p>
        ) : (
          hours.data && <HoursTimeline rules={rules} kids={kids} groups={groups} onEdit={(rule) => edit({ rule })} />
        )}
      </div>

      <div className="pk-panel">
        <h3>
          <Icon name="texture" size={18} />
          Patterns
        </h3>
        <div className="ph-legend">
          {LEGEND.map(([tex, label]) => (
            <span key={tex}>
              <span className={`sq pt ${tex}`} aria-hidden="true" />
              {label}
            </span>
          ))}
          {rules.some((r) => r.category === 'other' && r.everyone && r.kind === 'allowed') && (
            <span>
              <span className="sq pt pt-other" aria-hidden="true" />
              Other hours · light
            </span>
          )}
          {has('free') && (
            <span>
              <span className="sq" data-kind="free" aria-hidden="true" />
              Free time · dashed
            </span>
          )}
          {has('off') && (
            <span>
              <span className="sq" data-kind="off" aria-hidden="true" />
              Internet off
            </span>
          )}
        </div>
        <div className="ph-prec" role="group" aria-label="When rules overlap">
          When rules overlap:{' '}
          <span className="ph-p2">
            <span className="sq pt pt-holi" aria-hidden="true" />
            <span className="sq pt pt-summer" aria-hidden="true" />
            Holiday and Summer
          </span>
          <span className="ph-sep" aria-hidden="true">{' › '}</span>
          <span className="ph-p2">
            <span className="sq pt pt-kid" aria-hidden="true" />
            Per child
          </span>
          <span className="ph-sep" aria-hidden="true">{' › '}</span>
          <span className="ph-p2">
            <span className="sq pt pt-group" aria-hidden="true" />
            Per group
          </span>
          <span className="ph-sep" aria-hidden="true">{' › '}</span>
          <span className="ph-p2">
            <span className="sq pt pt-week" aria-hidden="true" />
            Everyone
          </span>
        </div>
      </div>

      {family && (
        <div className="pk-panel">
          <h3>
            <Icon name="tune" size={18} />
            Rules
          </h3>
          <div className="pk-switch ph-sw-row">
            <span id="chores-lock-label">Lock until today&apos;s chores are done</span>
            <button
              type="button"
              role="switch"
              aria-checked={family.chores_lock}
              aria-labelledby="chores-lock-label"
              aria-disabled={patch.isPending || undefined}
              onClick={() => !patch.isPending && patch.mutate({ chores_lock: !family.chores_lock }, { onError: toastFail, onSuccess: () => toastOk('Saved') })}
            />
          </div>
        </div>
      )}

      <RuleEditor opened={open} rule={editing.rule} initial={editing.initial} onClose={() => setOpen(false)} />
    </section>
  )
}
