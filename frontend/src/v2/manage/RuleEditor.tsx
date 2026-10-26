import { useId, useState } from 'react'
import { Drawer } from '@mantine/core'
import { useDisclosure, useMediaQuery } from '@mantine/hooks'
import { useDeleteRule, useSaveRule } from '@/v2/hooks/useHours'
import { useKids } from '@/v2/hooks/useKids'
import { useGroups } from '@/v2/hooks/useDevices'
import { Icon } from '@/v2/parent/Icon'
import { SegmentedControl } from '@/v2/parent/SegmentedControl'
import type { HourRule, RuleBody, RuleCategory, RuleKind } from '@/v2/types'
import { ConfirmDelete } from './ConfirmDelete'
import { KidPills } from './KidPills'
import { CATEGORIES, KINDS, SUN_FIRST, presetDays } from './hoursMeta'
import { RuleTimes, type Range } from './RuleTimes'
import { useSingle } from './useSingle'
import { toastOk } from '../notify'

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const ALL = CATEGORIES.map((c) => c.key)

interface Props {
  opened: boolean
  /** Edit this rule; omit to add one. */
  rule?: HourRule
  /** Starting values for a new rule (e.g. `{category: 'holiday'}`). */
  initial?: Partial<RuleBody>
  categories?: RuleCategory[]
  /** Show the Who field; without it the rule is for everyone. */
  showWho?: boolean
  onClose: () => void
  /** Draft mode (setup): hand back the body instead of saving it. */
  onSave?: (body: RuleBody) => void
  /** Draft mode delete; without it Delete calls the API. */
  onDelete?: () => void
}

/** Right-hand drawer to add or edit one named hour rule. */
export function RuleEditor({ opened, rule, onClose, ...rest }: Props) {
  const small = useMediaQuery('(max-width: 767px)')
  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      position="right"
      size={small ? '100%' : 460}
      title={rule ? 'Edit hours' : 'Add hours'}
      closeButtonProps={{ 'aria-label': 'Close' }}
      zIndex={350} // above the chat dock; ConfirmDelete (400) stays on top
      classNames={{ content: 'pk-sheet', header: 'pk-sheet-head', title: 'pk-sheet-title', body: 'pk-sheet-body' }}
    >
      <RuleForm key={rule?.id ?? `new-${rest.initial?.category ?? ''}`} rule={rule} onClose={onClose} {...rest} />
    </Drawer>
  )
}

function firstError(b: RuleBody, ranged: boolean, who: boolean): string | null {
  const dated = b.category === 'holiday' || b.category === 'summer'
  if (dated && (!b.start_date || !b.end_date)) return 'Holidays and summer need a first and last day.'
  if (ranged && (!b.start_date || !b.end_date)) return 'Give both a first and last day, or neither.'
  if (b.start_date && b.end_date && b.end_date < b.start_date) return "The last day can't be before the first day."
  if (!b.days) return 'Pick at least one day.'
  if (who && !b.everyone && !b.kid_ids.length && !b.group_ids.length) return 'Pick who this is for.'
  if (b.times.some((t) => !t.start || !t.end)) return 'Fill in every time.'
  if (b.times.some((t) => t.start === t.end)) return "Start and end can't be the same."
  return null
}

// mounted only while the drawer is open, so every open starts from the rule's saved values
function RuleForm({ rule, initial, categories = ALL, showWho = true, onClose, onSave, onDelete }: Omit<Props, 'opened'>) {
  const start = rule ?? initial ?? {}
  const id = useId()
  const kids = useKids().data ?? []
  const groups = useGroups().data ?? []
  const save = useSaveRule()
  const saveOnce = useSingle(save)
  const del = useDeleteRule()
  const [confirm, { open, close }] = useDisclosure(false)
  const [name, setName] = useState(start.name ?? '')
  const [category, setCategory] = useState<RuleCategory>(start.category ?? categories[0])
  const [kind, setKind] = useState<RuleKind>(start.kind ?? 'allowed')
  const [days, setDays] = useState(start.days ?? presetDays(start.category ?? categories[0]) ?? '0123456')
  const [everyone, setEveryone] = useState(start.everyone ?? true)
  const [kidIds, setKidIds] = useState(start.kid_ids ?? [])
  const [groupIds, setGroupIds] = useState(start.group_ids ?? [])
  const [ranged, setRanged] = useState(!!start.start_date)
  const [from, setFrom] = useState(start.start_date ?? '')
  const [to, setTo] = useState(start.end_date ?? '')
  const [times, setTimes] = useState<Range[]>(start.times?.length ? start.times : [{ start: '15:00', end: '20:00' }])

  const dated = category === 'holiday' || category === 'summer'
  const useDates = dated || ranged
  const all = !showWho || everyone
  const body: RuleBody = {
    name: name.trim(),
    category,
    kind,
    days,
    times,
    everyone: all,
    kid_ids: all ? [] : [...kidIds].sort((a, b) => a - b),
    group_ids: all ? [] : [...groupIds].sort((a, b) => a - b),
    start_date: useDates && from ? from : null,
    end_date: useDates && to ? to : null,
  }
  const error = firstError(body, !dated && ranged, showWho)
  const kindLabel = KINDS.find((k) => k.key === kind)?.times ?? 'Times'

  const pickCategory = (c: RuleCategory) => {
    setCategory(c)
    const preset = presetDays(c)
    if (preset !== null) setDays(preset)
  }
  const toggleDay = (d: number) =>
    setDays(days.includes(String(d)) ? days.replace(String(d), '') : (days + d).split('').sort().join(''))
  const toggleGroup = (g: number) => setGroupIds(groupIds.includes(g) ? groupIds.filter((x) => x !== g) : [...groupIds, g])

  const submit = () => {
    if (onSave) return onSave(body), onClose()
    saveOnce({ id: rule?.id, body }, { onSuccess: () => (toastOk(rule ? 'Saved' : 'Hours added'), onClose()) })
  }
  const remove = () => {
    if (onDelete) return onDelete(), onClose()
    if (rule) del.mutate(rule.id, { onSuccess: () => (toastOk('Deleted'), onClose()) })
  }

  return (
    <div className="pk-form">
      <div className="pk-field">
        <label className="pk-label" htmlFor={`${id}-name`}>Name</label>
        <span className="ph-fi">
          <Icon name="label" size={18} />
          <input id={`${id}-name`} value={name} maxLength={60} required placeholder={CATEGORIES.find((c) => c.key === category)?.plural} onChange={(e) => setName(e.currentTarget.value)} />
        </span>
      </div>
      {categories.length > 1 && (
        <div className="pk-field">
          <span className="pk-label">Kind</span>
          <div className="ph-kinds" role="group" aria-label="Kind">
            {CATEGORIES.filter((c) => categories.includes(c.key)).map((c) => (
              <button key={c.key} type="button" aria-pressed={category === c.key} onClick={() => pickCategory(c.key)}>
                <i className={`sq pt ${c.texture}`} aria-hidden="true" />
                {c.plural}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="pk-field pk-seg">
        <span className="pk-label">What it does</span>
        <SegmentedControl label="What it does" value={kind} onChange={setKind} options={KINDS.map((k) => ({ value: k.key, label: k.label }))} />
      </div>
      {showWho && (
        <div className="pk-field">
          <div className="pk-switch ph-sw-row">
            <span id={`${id}-all`}>Everyone</span>
            <button type="button" role="switch" aria-checked={everyone} aria-labelledby={`${id}-all`} onClick={() => setEveryone(!everyone)} />
          </div>
          {!everyone && (
            <>
              <KidPills kids={kids} value={kidIds} onChange={setKidIds} label="Kids" />
              {groups.length > 0 && (
                <div className="pk-pills" role="group" aria-label="Groups">
                  {groups.map((g) => (
                    <button key={g.id} type="button" className="pk-pill pk-pill-plain" aria-pressed={groupIds.includes(g.id)} onClick={() => toggleGroup(g.id)}>
                      {g.name}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
      <div className="pk-field">
        <span className="pk-label">Days</span>
        <div className="pk-days" role="group" aria-label="Days">
          {SUN_FIRST.map((d) => (
            <button key={d} type="button" className="pk-day" aria-label={DAY_NAMES[d]} title={DAY_NAMES[d]} aria-pressed={days.includes(String(d))} onClick={() => toggleDay(d)}>
              {DAY_NAMES[d][0]}
            </button>
          ))}
        </div>
      </div>
      <div className="pk-field">
        {!dated && (
          <div className="pk-switch ph-sw-row">
            <span id={`${id}-dates`}>Only between dates</span>
            <button type="button" role="switch" aria-checked={ranged} aria-labelledby={`${id}-dates`} onClick={() => setRanged(!ranged)} />
          </div>
        )}
        {useDates && (
          <div className="pk-row2">
            <label className="pk-field">
              <span className="pk-label">First day</span>
              <input className="pk-input" type="date" value={from} required onChange={(e) => setFrom(e.currentTarget.value)} />
            </label>
            <label className="pk-field">
              <span className="pk-label">Last day</span>
              <input className="pk-input" type="date" value={to} min={from || undefined} required onChange={(e) => setTo(e.currentTarget.value)} />
            </label>
          </div>
        )}
      </div>
      <RuleTimes label={kindLabel} times={times} onChange={setTimes} />
      <div aria-live="polite">{error && <span className="pk-error">{error}</span>}</div>
      <div className="pk-foot pk-sheet-foot">
        <button type="button" className="p-btn pk-foot-start" onClick={onClose}>
          Cancel
        </button>
        {rule && (onDelete || !onSave) && (
          <button type="button" className="p-btn" data-variant="red" onClick={open}>
            Delete
          </button>
        )}
        <button type="button" className="p-btn" data-variant="accent" onClick={submit} disabled={!!error || !body.name || save.isPending} aria-busy={save.isPending}>
          <Icon name="check" />
          Save
        </button>
      </div>
      <ConfirmDelete opened={confirm} onClose={close} title={`Delete ${rule?.name ?? ''}?`} body="Its kids and groups go back to their other hours." onConfirm={remove} />
    </div>
  )
}
