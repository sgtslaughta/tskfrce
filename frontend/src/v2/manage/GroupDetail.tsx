import { useEffect, useState } from 'react'
import { useDisclosure } from '@mantine/hooks'
import { useDeleteGroup, useSaveGroup } from '@/v2/hooks/useDevices'
import Link from 'next/link'
import { GlyphPicker } from '@/v2/parent/GlyphPicker'
import { HeaderChips } from '@/v2/parent/HeaderChips'
import { Icon } from '@/v2/parent/Icon'
import type { Device, Group, HourRule, Kid } from '@/v2/types'
import { ActionButton } from './ActionButton'
import { ConfirmDelete } from './ConfirmDelete'
import { GroupStats } from './GroupStats'
import { HoursTimeline } from './HoursTimeline'
import { nameOf } from './choreMeta'
import { toastFail, toastOk, toasts } from '../notify'
import { useSingleFlight } from './useSingleFlight'

export const GROUP_ICONS = ['tablet_mac', 'sports_esports', 'tv', 'laptop', 'smartphone', 'speaker', 'router', 'devices_other', 'devices']

interface Props {
  /** Omit to create a new group. */
  group?: Group
  devices: Device[]
  kids: Kid[]
  groups?: Group[]
  rules?: HourRule[]
  /** Select a group, or null to close the detail. */
  onSelect: (id: number | null) => void
  onRequestOverride: (req: { kind: string; id: number; action: string }) => void
  /** Family time zone for the next-lock time. */
  timeZone?: string
  /** Override action in flight (lock / unlock / clear), if any. */
  pendingAction?: string | null
}

/**
 * Group editor. An existing group saves as you go (name on blur, members on tap);
 * a new group is a small form with Create / Cancel.
 */
export function GroupDetail({ group, devices, kids, groups, rules, onSelect, onRequestOverride, timeZone, pendingAction = null }: Props) {
  const save = useSaveGroup()
  const del = useDeleteGroup()
  const once = useSingleFlight()
  const [confirm, { open, close }] = useDisclosure(false)
  const [name, setName] = useState(group?.name ?? '')
  const [draftIds, setDraftIds] = useState<number[]>([])
  const [draft, setDraft] = useState<{ icon?: string; chore_lock?: boolean }>({})
  useEffect(() => setName(group?.name ?? ''), [group?.name])

  const icon = group?.icon ?? draft.icon ?? 'devices'
  const choreLock = group?.chore_lock ?? draft.chore_lock ?? true
  const ids = group ? group.device_ids : draftIds
  const members = devices.filter((d) => ids.includes(d.id))
  const locked = members.filter((d) => d.override?.action === 'lock').length
  const memberOwners = members.flatMap((d) => d.owner_ids)
  const owners = kids.filter((k) => memberOwners.includes(k.id)).map(nameOf).join(', ')

  const chips = [
    { text: `${members.length} ${members.length === 1 ? 'device' : 'devices'}` },
    ...(members.length ? [{ text: `${members.length - locked} open` }, { text: `${locked} locked` }] : []),
    ...(owners ? [{ text: owners }] : []),
  ]

  const toggle = (id: number) => {
    const next = ids.includes(id) ? ids.filter((i) => i !== id) : [...ids, id]
    if (group) once((settled) => save.mutate({ id: group.id, name: group.name, device_ids: next }, { ...toasts('Saved'), ...settled }))
    else setDraftIds(next)
  }
  const rename = () => {
    const n = name.trim()
    if (!group) return
    if (!n) setName(group.name)
    else if (n !== group.name) once((settled) => save.mutate({ id: group.id, name: n, device_ids: group.device_ids }, { ...toasts('Renamed'), ...settled }))
  }
  const setExtra = (extra: { icon?: string; chore_lock?: boolean }) => {
    if (group) once((settled) => save.mutate({ id: group.id, name: group.name, device_ids: group.device_ids, icon, chore_lock: choreLock, ...extra }, { ...toasts('Saved'), ...settled }))
    else setDraft({ ...draft, ...extra })
  }
  const create = () =>
    once((settled) =>
      save.mutate(
        { name: name.trim(), device_ids: draftIds, ...draft },
        {
          onError: toastFail,
          onSuccess: (g) => {
            toastOk('Created')
            onSelect((g as Group).id)
          },
          ...settled,
        },
      ),
    )

  return (
    <div className="pk-detail">
      <header className="pk-head">
        <span className="pk-tile pk-tile-lg">
          <Icon name={icon} size={30} />
        </span>
        <div className="pk-head-t">
          <h2>{(group ? group.name : name).trim() || 'New group'}</h2>
          <HeaderChips items={chips} />
        </div>
        {group && (
          <div className="pk-actions pk-actions-grid">
            <ActionButton icon="lock" variant="red" busy={pendingAction === 'lock'} disabled={!!pendingAction || members.length === 0} onClick={() => onRequestOverride({ kind: 'group', id: group.id, action: 'lock' })}>
              Lock group
            </ActionButton>
            <ActionButton icon="lock_open" busy={pendingAction === 'unlock'} disabled={!!pendingAction || members.length === 0} onClick={() => onRequestOverride({ kind: 'group', id: group.id, action: 'unlock' })}>
              Unlock 30 min
            </ActionButton>
            <ActionButton icon="event_repeat" busy={pendingAction === 'clear'} disabled={!!pendingAction || members.length === 0} onClick={() => onRequestOverride({ kind: 'group', id: group.id, action: 'schedule' })}>
              Back to schedule
            </ActionButton>
            <ActionButton icon="delete" variant="red" busy={del.isPending} onClick={open}>
              Delete
            </ActionButton>
          </div>
        )}
      </header>

      <div className="pk-grid">
        <section className="pk-panel" aria-label="Devices in group">
          <h3>
            <Icon name="devices_other" size={18} />
            Devices in group
          </h3>
          {devices.length > 0 && ids.length === 0 && <p className="pk-hint">No devices in this group yet. Tap a device to add it.</p>}
          {devices.length === 0 ? (
            <p className="pk-hint">No devices yet.</p>
          ) : (
            <div className="pk-pills" role="group" aria-label="Devices in group">
              {devices.map((d) => (
                <button key={d.id} type="button" title={d.name} className="pk-pill pk-pill-plain" aria-pressed={ids.includes(d.id)} aria-disabled={(save.isPending && !!group) || undefined} onClick={() => !(save.isPending && group) && toggle(d.id)}>
                  {d.name}
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="pk-panel" aria-label="Group">
          <h3>
            <Icon name="edit" size={18} />
            Group
          </h3>
          <label className="pk-field">
            <span className="pk-label">Group name</span>
            <input
              className="pk-input"
              aria-label="Group name"
              aria-busy={save.isPending || undefined}
              placeholder="Group name"
              maxLength={100}
              value={name}
              onChange={(e) => setName(e.currentTarget.value)}
              onBlur={rename}
              onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
            />
          </label>
          <div className="pk-field">
            <span className="pk-label">Icon</span>
            <div className="pk-type-icons pk-group-icons">
              <GlyphPicker value={icon} onChange={(g) => g !== icon && setExtra({ icon: g })} choices={GROUP_ICONS} />
            </div>
          </div>
          <div className="pk-switch ph-sw-row">
            <span id="group-chore-label">Lock with the kids&apos; chores</span>
            <button type="button" role="switch" aria-checked={choreLock} aria-labelledby="group-chore-label" aria-disabled={(save.isPending && !!group) || undefined} onClick={() => !(save.isPending && group) && setExtra({ chore_lock: !choreLock })} />
          </div>
          <p className="pk-hint">Off: these devices skip the chore check. Hours and manual locks still apply.</p>
        </section>
        {group && rules && (
          <section className="pk-panel pk-span" aria-label="Hours">
            <h3>
              <Icon name="calendar_month" size={18} />
              Hours for this group
              <Link className="pk-h3-link" href="/settings?section=hours">
                Edit in Settings → Hours
              </Link>
            </h3>
            <HoursTimeline rules={rules.filter((r) => r.everyone || r.group_ids.includes(group.id))} kids={kids} groups={groups ?? []} thisGroup />
          </section>
        )}
      </div>

      {group && <GroupStats members={members} timeZone={timeZone} />}

      {!group && (
        <div className="pk-foot">
          <button type="button" className="p-btn" onClick={() => onSelect(null)}>
            Cancel
          </button>
          <button type="button" className="p-btn" data-variant="accent" onClick={create} disabled={!name.trim() || save.isPending}>
            <Icon name={save.isPending ? 'progress_activity' : 'check'} className={save.isPending ? 'p-spin' : undefined} />
            {save.isPending ? 'Creating…' : 'Create group'}
          </button>
        </div>
      )}

      {group && (
        <ConfirmDelete
          opened={confirm}
          title={`Delete ${group.name}?`}
          body="The devices stay. This group's hours are removed."
          onConfirm={() => !del.isPending && del.mutate(group.id, { onSuccess: () => onSelect(null) })}
          onClose={close}
        />
      )}
    </div>
  )
}
