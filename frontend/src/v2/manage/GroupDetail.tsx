import { HeaderChips } from '@/v2/parent/HeaderChips'
import { Chip } from '@/v2/parent/Chip'
import { Icon } from '@/v2/parent/Icon'
import { HoursTimeline } from './HoursTimeline'
import type { Device, Group, Kid, TimeWindow } from '@/v2/types'

interface Props {
  group: Group
  devices: Device[]
  kids: Kid[]
  groups?: Group[]
  windows?: TimeWindow[]
  onClose: () => void
  onRequestOverride: (req: { kind: string; id: number; action: string }) => void
}

const ownerNames = (kids: Kid[], ownerIds: number[] | undefined) => {
  if (!ownerIds || ownerIds.length === 0) return 'No owners'
  return kids
    .filter((k) => ownerIds.includes(k.id))
    .map((k) => k.full_name || k.username)
    .join(', ')
}

export function GroupDetail({ group, devices, kids, groups, windows, onClose, onRequestOverride }: Props) {
  const groupDevices = devices.filter((d) => group.device_ids.includes(d.id))
  const locked = groupDevices.filter((d) => d.override?.action === 'lock').length
  const open = groupDevices.length - locked

  const headerChips = [
    { text: `${groupDevices.length} devices` },
    { text: `${open} open` },
    { text: `${locked} locked` },
    { text: ownerNames(kids, group.owner_ids) },
  ]

  return (
    <div className="p-detail-column p-grid" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <h2 style={{ margin: '0 0 8px 0', fontSize: 20, fontWeight: 600, color: 'var(--p-ink)' }}>
          {group.name}
        </h2>
        <HeaderChips items={headerChips} />
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button className="p-btn" data-variant="red" onClick={() => onRequestOverride({ kind: 'group', id: group.id, action: 'lock' })}>
          <Icon name="lock" size={16} />
          Lock group
        </button>
        <button className="p-btn" onClick={() => onRequestOverride({ kind: 'group', id: group.id, action: 'unlock' })}>
          <Icon name="lock_open" size={16} />
          Unlock 30 min
        </button>
        <button className="p-btn" onClick={() => onRequestOverride({ kind: 'group', id: group.id, action: 'schedule' })}>
          <Icon name="arrow_back" size={16} />
          Back to schedule
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="p-card" style={{ padding: 16, borderRadius: 16, border: '1px solid var(--p-line)', backgroundColor: 'var(--p-soft)' }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: 13, fontWeight: 600, color: 'var(--p-ink)' }}>
            Group name
          </h3>
          <div style={{ padding: '8px 12px', background: 'var(--p-card)', border: '1px solid var(--p-line)', borderRadius: 8, fontSize: 13, color: 'var(--p-ink)' }}>
            {group.name}
          </div>
        </div>

        <div className="p-card" style={{ padding: 16, borderRadius: 16, border: '1px solid var(--p-line)', backgroundColor: 'var(--p-soft)' }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: 13, fontWeight: 600, color: 'var(--p-ink)' }}>
            Devices in group
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {groupDevices.map((d) => (
              <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--p-line)', fontSize: 13, color: 'var(--p-ink)' }}>
                <span>{d.name}</span>
                <button className="p-btn" style={{ fontSize: 11, padding: '4px 8px' }} onClick={() => {}}>
                  Remove
                </button>
              </div>
            ))}
          </div>
          <button className="p-btn" style={{ marginTop: 12, width: '100%' }} onClick={() => {}}>
            <Icon name="add" size={16} />
            Add a device
          </button>
        </div>

        {windows && (
          <div className="p-card" style={{ padding: 16, borderRadius: 16, border: '1px solid var(--p-line)', backgroundColor: 'var(--p-soft)' }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: 13, fontWeight: 600, color: 'var(--p-ink)' }}>
              Hours for {group.name}
            </h3>
            <HoursTimeline windows={windows ?? []} kids={kids} groups={groups ?? []} />
          </div>
        )}
      </div>
    </div>
  )
}
