import { useFamily } from '@/v2/hooks/useFamily'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { notifications } from '@mantine/notifications'
import { useDisclosure } from '@mantine/hooks'
import { useDeleteDevice, usePatchDevice, useSaveGroup, useTestBlock, type DevicePatch } from '@/v2/hooks/useDevices'
import { Chip } from '@/v2/parent/Chip'
import { HeaderChips } from '@/v2/parent/HeaderChips'
import { Icon } from '@/v2/parent/Icon'
import { SegmentedControl } from '@/v2/parent/SegmentedControl'
import type { Device, Group, Kid } from '@/v2/types'
import { ConfirmDelete } from './ConfirmDelete'
import { DeviceNetwork } from './DeviceNetwork'
import { DEVICE_TYPE_ICON, getDeviceType } from './deviceMeta'
import { KidPills } from './KidPills'
import { nameOf } from './choreMeta'
import { toastFail, toastOk, toasts } from '../notify'

interface Props {
  device: Device
  kids: Kid[]
  groups?: Group[]
  /** Called after the device is deleted. */
  onDeleted?: () => void
  onRequestOverride: (req: { kind: string; id: number; action: string }) => void
}

const relativeTime = (iso: string | null) => {
  if (!iso) return 'never'
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  return hours < 24 ? `${hours}h ago` : `${Math.floor(hours / 24)}d ago`
}

/** Device editor: header actions, Overview (details, owners, groups, right now) and Network tabs. */
export function DeviceDetail({ device, kids, groups = [], onDeleted, onRequestOverride }: Props) {
  const router = useRouter()
  const patch = usePatchDevice()
  const saveGroup = useSaveGroup()
  const del = useDeleteDevice()
  const test = useTestBlock()
  const [tab, setTab] = useState<string | null>('overview')
  const [name, setName] = useState(device.name)
  const [confirm, { open, close }] = useDisclosure(false)
  useEffect(() => setName(device.name), [device.name])

  const guest = device.status === 'guest'
  const unknown = device.status === 'unassigned'
  // learning mode (the default) leaves new devices online; strict mode blocks them
  const blockNew = useFamily().data?.new_devices_blocked ?? false
  const owners = kids.filter((k) => device.owner_ids.includes(k.id))
  const ownerLabel = guest ? 'Guest' : owners.length ? owners.map(nameOf).join(', ') : 'Unassigned'
  const needsPins = device.needs_pins && owners.length > 0

  const save = (p: DevicePatch, done: string) => patch.mutate({ id: device.id, patch: p }, toasts(done))
  const rename = () => {
    const n = name.trim()
    if (!n) setName(device.name)
    else if (n !== device.name) save({ name: n }, 'Renamed')
  }
  const toggleGroup = (g: Group) => {
    const ids = g.device_ids.includes(device.id) ? g.device_ids.filter((i) => i !== device.id) : [...g.device_ids, device.id]
    saveGroup.mutate({ id: g.id, name: g.name, device_ids: ids }, toasts('Saved'))
  }
  const runTest = () =>
    test.mutate(device.id, {
      onSuccess: (r) => (r.reason === 'ok' ? toastOk(r.message) : notifications.show({ message: r.message, color: 'fridgeRed' })),
      onError: toastFail,
    })

  const chips = [
    ...(device.vendor ? [{ text: device.vendor, vendor: device.vendor }] : []),
    { text: device.online ? 'Online now' : `Last seen ${relativeTime(device.last_seen)}`, tone: device.online ? ('acc' as const) : ('plain' as const), icon: device.online ? 'wifi' : 'schedule' },
    ...(device.ip ? [{ text: device.ip, tone: 'mono' as const, icon: 'lan' }] : []),
    { text: ownerLabel, icon: 'person' },
  ]

  const ownersPanel = (
    <section className="pk-panel" data-tone={unknown ? 'amber' : undefined} aria-label="Owners">
      <h3>
        <Icon name={unknown ? 'help' : 'person'} size={18} />
        {unknown ? "Who's this?" : 'Owners'}
      </h3>
      {unknown && (
        <p className="pk-hint">
          {blockNew
            ? 'This device is new and blocked until you say whose it is.'
            : 'This device is new. It stays online until you say whose it is.'}{' '}
          Pick the kid to give it their rules, or mark it as a guest.
        </p>
      )}
      <KidPills
        kids={kids}
        label="Owners"
        value={device.owner_ids}
        disabled={guest}
        onChange={(ids) => save({ owner_ids: ids }, 'Assigned')}
      />
      {needsPins && (
        <div className="pk-note">
          <p>{owners.map(nameOf).join(' and ')} share this device. Add PINs so they can&apos;t sign in as each other.</p>
          <button type="button" className="p-btn" onClick={() => router.push(`/kids?section=kids&kid=${(owners.find((k) => !k.has_pin) ?? owners[0]).id}&pin=1`)}>
            Set PINs
          </button>
        </div>
      )}
    </section>
  )

  const detailsPanel = (
    <section className="pk-panel" aria-label="Details">
      <h3>
        <Icon name="info" size={18} />
        Details
      </h3>
      <label className="pk-field">
        <span className="pk-label">Name</span>
        <input
          className="pk-input"
          aria-label="Device name"
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
          onBlur={rename}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        />
      </label>
      {groups.length > 0 && (
        <div className="pk-field">
          <span className="pk-label">Groups</span>
          <div className="pk-pills" role="group" aria-label="Groups">
            {groups.map((g) => (
              <button key={g.id} type="button" className="pk-pill pk-pill-plain" aria-pressed={g.device_ids.includes(device.id)} disabled={saveGroup.isPending} onClick={() => toggleGroup(g)}>
                {g.name}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="pk-switch">
        <span id="guest-label">Guest (never blocked)</span>
        <button
          type="button"
          role="switch"
          aria-checked={guest}
          aria-labelledby="guest-label"
          onClick={() => save({ status: !guest ? 'guest' : device.owner_ids.length ? 'assigned' : 'unassigned' }, 'Saved')}
        />
      </div>
    </section>
  )

  return (
    <div className="pk-detail">
      <header className="pk-head">
        <span className="pk-tile pk-tile-lg">
          <Icon name={DEVICE_TYPE_ICON[getDeviceType(device.name, device.vendor)]} size={30} />
        </span>
        <div className="pk-head-t">
          <h2>{device.name}</h2>
          <HeaderChips items={chips} />
          {device.resisting && (
            <div className="pk-chips">
              <Chip tone="red" icon="gpp_maybe">
                getting around the block
              </Chip>
            </div>
          )}
        </div>
        <div className="pk-actions">
          <button type="button" className="p-btn" data-variant="red" onClick={() => onRequestOverride({ kind: 'device', id: device.id, action: 'lock' })}>
            <Icon name="lock" size={16} />
            Lock now
          </button>
          <button type="button" className="p-btn" onClick={() => onRequestOverride({ kind: 'device', id: device.id, action: 'unlock' })}>
            <Icon name="lock_open" size={16} />
            Unlock 30 min
          </button>
          <button type="button" className="p-btn" aria-label={`Test block on ${device.name}`} disabled={test.isPending} onClick={runTest}>
            <Icon name="shield" size={16} />
            {test.isPending ? 'Testing…' : 'Test block'}
          </button>
          <button type="button" className="p-btn" data-variant="red" onClick={open}>
            <Icon name="delete" size={16} />
            Delete
          </button>
        </div>
      </header>

      <SegmentedControl
        value={tab || 'overview'}
        onChange={setTab}
        options={[
          { value: 'overview', label: 'Overview' },
          { value: 'network', label: 'Network' },
        ]}
      />

      {tab === 'overview' && (
        <div className="pk-grid">
          {unknown ? ownersPanel : detailsPanel}
          {unknown ? detailsPanel : ownersPanel}
          <section className="pk-panel pk-span" aria-label="Right now">
            <h3>
              <Icon name="bolt" size={18} />
              Right now
            </h3>
            <div className="pk-kv">
              <span>State</span>
              <b>{guest ? 'Guest' : device.online ? 'Online' : 'Offline'}</b>
            </div>
            <div className="pk-kv">
              <span>Override</span>
              <b>{device.override ? device.override.action : 'None, on schedule'}</b>
            </div>
            {device.override?.expires_at && (
              <div className="pk-kv">
                <span>Expires at</span>
                <b>{new Date(device.override.expires_at).toLocaleString()}</b>
              </div>
            )}
          </section>
        </div>
      )}
      {tab === 'network' && <DeviceNetwork device={device} />}

      <ConfirmDelete
        opened={confirm}
        title={`Delete ${device.name}?`}
        body="It will show up as a new device if it connects again."
        onConfirm={() => del.mutate(device.id, { onSuccess: onDeleted })}
        onClose={close}
      />
    </div>
  )
}
