import { useState } from 'react'
import { Icon } from '@/v2/parent/Icon'
import { HoursTimeline } from '@/v2/manage/HoursTimeline'
import { RuleEditor } from '@/v2/manage/RuleEditor'
import type { HourRule, RuleBody, RuleCategory } from '@/v2/types'
import styles from './wizard.module.css'

const base: Pick<RuleBody, 'kind' | 'start_date' | 'end_date' | 'everyone' | 'kid_ids' | 'group_ids'> = { kind: 'allowed', start_date: null, end_date: null, everyone: true, kid_ids: [], group_ids: [] }

export const DEFAULT_DRAFTS: RuleBody[] = [
  { ...base, name: 'School nights', category: 'school_night', days: '01236', times: [{ start: '06:00', end: '08:00' }, { start: '15:00', end: '20:00' }] },
  { ...base, name: 'Weekends', category: 'weekend', days: '45', times: [{ start: '08:00', end: '22:00' }] },
]

const CATEGORIES: RuleCategory[] = ['school_night', 'weekend']
const BEDTIMES: { category: RuleCategory; label: string }[] = [
  { category: 'school_night', label: 'Bedtime on school nights' },
  { category: 'weekend', label: 'Bedtime on weekends' },
]

interface Props {
  drafts: RuleBody[]
  onChange: (d: RuleBody[]) => void
  choresLock: boolean
  onChoresLock: (v: boolean) => void
}

/** Setup step 6: starting hours as drafts; they are POSTed to /hours by Next. */
export function StepHours({ drafts, onChange, choresLock, onChoresLock }: Props) {
  const [editing, setEditing] = useState<number | null | undefined>(undefined) // undefined closed, null new
  const asRules: HourRule[] = drafts.map((d, i) => ({ ...d, id: i + 1 }))
  const open = editing !== undefined
  const current = typeof editing === 'number' ? asRules[editing] : undefined

  const save = (body: RuleBody) =>
    onChange(typeof editing === 'number' ? drafts.map((d, i) => (i === editing ? body : d)) : [...drafts, body])
  const setEnd = (index: number, end: string) =>
    onChange(drafts.map((d, i) => (i === index ? { ...d, times: d.times.map((t, j) => (j === d.times.length - 1 ? { ...t, end } : t)) } : d)))

  return (
    <>
      <div className="pk-panel">
        {/* first heading under the step h1 (axe heading-order); keeps the panel h3 styling */}
        <h3 aria-level={2}>
          <Icon name="calendar_month" size={18} />
          Allowed hours
          <button type="button" className={`p-btn ${styles.addHours}`} onClick={() => setEditing(null)}>
            <Icon name="add" size={16} />
            Add hours
          </button>
        </h3>
        <HoursTimeline rules={asRules} kids={[]} groups={[]} onEdit={(r) => setEditing(r.id - 1)} />
      </div>
      <div className={`pk-panel ${styles.rules}`}>
        {BEDTIMES.map(({ category, label }) => {
          const i = drafts.findIndex((d) => d.category === category)
          if (i < 0) return null
          return (
            <label key={category} className={styles.kv}>
              <span>{label}</span>
              <input type="time" value={drafts[i].times.at(-1)?.end ?? ''} onChange={(e) => e.currentTarget.value && setEnd(i, e.currentTarget.value)} />
            </label>
          )
        })}
        <div className="pk-switch ph-sw-row">
          <span id="setup-chores-lock">Lock until today&apos;s chores are done</span>
          <button type="button" role="switch" aria-checked={choresLock} aria-labelledby="setup-chores-lock" onClick={() => onChoresLock(!choresLock)} />
        </div>
      </div>
      <RuleEditor
        opened={open}
        rule={current}
        initial={{ category: 'school_night' }}
        categories={CATEGORIES}
        showWho={false}
        onClose={() => setEditing(undefined)}
        onSave={save}
        onDelete={typeof editing === 'number' ? () => onChange(drafts.filter((_, i) => i !== editing)) : undefined}
      />
    </>
  )
}
