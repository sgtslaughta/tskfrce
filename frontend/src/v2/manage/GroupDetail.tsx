import { useEffect, useState } from 'react'
import { useDisclosure } from '@mantine/hooks'
import { useDeleteGroup, useSaveGroup } from '@/v2/hooks/useDevices'
import { HeaderChips } from '@/v2/parent/HeaderChips'
import { Icon } from '@/v2/parent/Icon'
import type { Device, Group, Kid, TimeWindow } from '@/v2/types'
import { ConfirmDelete } from './ConfirmDelete'
import { HoursTimeline } from './HoursTimeline'
import { nameOf } from './choreMeta'
import { toastFail, toastOk, toasts } from '../notify'

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
}

/**
 * Group editor. An existing group saves as you go (name on blur, members on tap);
 * a new group is a small form with Create / Cancel.
 */
export function GroupDetail({ group, devices, kids, groups, windows, onSelect, onRequestOverride }: Props) {
  const save = useSaveGroup()
  const del = useDeleteGroup()
  const [confirm, { open, close }] = useDisclosure(false)
  const [name, setName] = useState(group?.name ?? '')
  const [draftIds, setDraftIds] = useState<number[]>([])
  useEffect(() => setName(group?.name ?? ''), [group?.name])

  const ids = group ? group.device_ids : draftIds
  const members = devices.filter((d) => ids.includes(d.id))
  const locked = members.filter((d) => d.override?.action === 'lock').length
  const owners = kids.filter((k) => group?.owner_ids?.includes(k.id)).map(nameOf).join(', ')

  const chips = [
    { text: `${members.length} ${members.length === 1 ? 'device' : 'devices'}` },
    { text: `${members.length - locked} open` },
    { text: `${locked} locked` },
    ...(owners ? [{ text: owners }] : []),
  ]

  const toggle = (id: number) => {
    const next = ids.includes(id) ? ids.filter((i) => i !== id) : [...ids, id]
    if (group) save.mutate({ id: group.id, name: group.name, device_ids: next }, toasts('Saved'))
    else setDraftIds(next)
  }
  const rename = () => {
    const n = name.trim()
    if (!group) return
    if (!n) setName(group.name)
    else if (n !== group.name) save.mutate({ id: group.id, name: n, device_ids: group.device_ids }, toasts('Renamed'))
  }
  const create = () =>
    save.mutate(
      { name: name.trim(), device_ids: draftIds },
      {
        onError: toastFail,
        onSuccess: (g) => {
          toastOk('Created')
          onSelect((g as Group).id)
        },
      },
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
          <div className="pk-actions">
            <button type="button" className="p-btn" data-variant="red" onClick={() => onRequestOverride({ kind: 'group', id: group.id, action: 'lock' })}>
              <Icon name="lock" size={16} />
              Lock group
            </button>
            <button type="button" className="p-btn" onClick={() => onRequestOverride({ kind: 'group', id: group.id, action: 'unlock' })}>
              <Icon name="lock_open" size={16} />
              Unlock 30 min
            </button>
            <button type="button" className="p-btn" onClick={() => onRequestOverride({ kind: 'group', id: group.id, action: 'schedule' })}>
              <Icon name="arrow_back" size={16} />
              Back to schedule
            </button>
            <button type="button" className="p-btn" data-variant="red" onClick={open}>
              <Icon name="delete" size={16} />
              Delete
            </button>
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
            placeholder="Group name"
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
          {devices.length === 0 ? (
            <p className="pk-hint">No devices yet.</p>
          ) : (
            <div className="pk-pills" role="group" aria-label="Devices in group">
              {devices.map((d) => (
                <button key={d.id} type="button" className="pk-pill pk-pill-plain" aria-pressed={ids.includes(d.id)} disabled={save.isPending && !!group} onClick={() => toggle(d.id)}>
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
            <Icon name="check" />
            Create group
          </button>
        </div>
      )}

      {group && (
        <ConfirmDelete
          opened={confirm}
          title={`Delete ${group.name}?`}
          body="The devices stay. This group's hours are removed."
          onConfirm={() => del.mutate(group.id, { onSuccess: () => onSelect(null) })}
          onClose={close}
        />
      )}
    </div>
  )
}
