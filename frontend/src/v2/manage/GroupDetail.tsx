import { useEffect, useState } from 'react'
import { useDisclosure } from '@mantine/hooks'
import { useDeleteGroup, useSaveGroup } from '@/v2/hooks/useDevices'
import { HeaderChips } from '@/v2/parent/HeaderChips'
import { Icon } from '@/v2/parent/Icon'
import type { Device, Group, Kid, TimeWindow } from '@/v2/types'
import { ActionButton } from './ActionButton'
import { ConfirmDelete } from './ConfirmDelete'
import { HoursTimeline } from './HoursTimeline'
import { nameOf } from './choreMeta'
import { toastFail, toastOk, toasts } from '../notify'
import { useSingleFlight } from './useSingleFlight'

interface Props {
  /** Omit to create a new group. */
  group?: Group
  devices: Device[]
  kids: Kid[]
  groups?: Group[]
  windows?: TimeWindow[]
  /** Select a group, or null to close the detail. */
  onSelect: (id: number | null) => void
  onRequestOverride: (req: { kind: string; id: number; action: string }) => void
  /** Override action in flight (lock / unlock / clear), if any. */
  pendingAction?: string | null
}

/**
 * Group editor. An existing group saves as you go (name on blur, members on tap);
 * a new group is a small form with Create / Cancel.
 */
export function GroupDetail({ group, devices, kids, groups, windows, onSelect, onRequestOverride, pendingAction = null }: Props) {
  const save = useSaveGroup()
  const del = useDeleteGroup()
  const once = useSingleFlight()
  const [confirm, { open, close }] = useDisclosure(false)
  const [name, setName] = useState(group?.name ?? '')
  const [draftIds, setDraftIds] = useState<number[]>([])
  useEffect(() => setName(group?.name ?? ''), [group?.name])

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
  const create = () =>
    once((settled) =>
      save.mutate(
        { name: name.trim(), device_ids: draftIds },
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
          <Icon name="devices" size={30} />
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
        <section className="pk-panel" aria-label="Name">
          <h3>
            <Icon name="edit" size={18} />
            Group name
          </h3>
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
        </section>

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

        {group && windows && (
          <section className="pk-panel pk-span" aria-label="Hours">
            <h3>
              <Icon name="schedule" size={18} />
              Hours for {group.name}
            </h3>
            <HoursTimeline windows={windows.filter((w) => w.group_id === group.id)} kids={kids} groups={groups ?? []} />
          </section>
        )}
      </div>

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
