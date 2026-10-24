import { useState } from 'react'
import { Icon } from '@/v2/parent/Icon'
import type { Device, Group as DeviceGroup, Kid } from '@/v2/types'

interface Props {
  devices: Device[]
  kids: Kid[]
  groups?: DeviceGroup[]
  selectedDevice?: number | null
  selectedGroup?: number | null
  onSelectDevice: (id: number) => void
  onSelectGroup?: (id: number) => void
}

const statusChip = (status: string) => {
  if (status === 'open' || status === 'assigned') return { tone: 'acc' as const, text: 'Open', icon: 'lock_open' }
  if (status === 'locked') return { tone: 'grey' as const, text: 'Locked', icon: 'lock' }
  if (status === 'exempt') return { tone: 'lav' as const, text: 'Exempt', icon: 'shield' }
  if (status === 'guest') return { tone: 'grey' as const, text: 'Guest', icon: 'person' }
  return { tone: 'amb' as const, text: "Who's this?", icon: 'help' }
}

const ownerName = (kids: Kid[], ownerIds: number[]) => {
  if (ownerIds.length === 0) return '—'
  return kids
    .filter((k) => ownerIds.includes(k.id))
    .map((k) => k.full_name || k.username)
    .join(', ')
}

const relativeTime = (iso: string | null) => {
  if (!iso) return 'never seen'
  const date = new Date(iso)
  const now = new Date()
  const ms = now.getTime() - date.getTime()
  const mins = Math.floor(ms / 60000)
  if (mins < 60) return `${mins}m ago`
  if (mins < 120) return '1h ago'
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return date.toLocaleDateString()
}

type DeviceType = 'phone' | 'console' | 'tv' | 'laptop' | 'tablet' | 'other'

const DEVICE_TYPE_ICON: Record<DeviceType, string> = {
  phone: 'smartphone',
  tablet: 'tablet_mac',
  console: 'sports_esports',
  tv: 'tv',
  laptop: 'laptop_chromebook',
  other: 'devices_other',
}

const getDeviceType = (name: string, vendor?: string | null): DeviceType => {
  const text = `${name} ${vendor ?? ''}`
  if (/xbox|playstation|\bps[345]\b|nintendo|switch|steam ?deck/i.test(text)) return 'console'
  if (/\btv\b|roku|chromecast|fire ?stick|apple ?tv|shield|bravia/i.test(text)) return 'tv'
  if (/laptop|macbook|chromebook|thinkpad|\bpc\b|desktop|imac/i.test(text)) return 'laptop'
  if (/ipad|tablet|kindle/i.test(text)) return 'tablet'
  if (/phone|pixel|galaxy|android|iphone/i.test(text)) return 'phone'
  return 'other'
}

const getGroupDeviceTypes = (devices: Device[], groupDeviceIds: number[]): DeviceType[] => {
  const groupDevices = devices.filter((d) => groupDeviceIds.includes(d.id))
  const types: DeviceType[] = []
  const seen = new Set<DeviceType>()
  groupDevices.forEach((d) => {
    const type = getDeviceType(d.name, d.vendor)
    if (!seen.has(type)) {
      types.push(type)
      seen.add(type)
    }
  })
  return types
}

export function DeviceList({
  devices,
  kids,
  groups = [],
  selectedDevice,
  selectedGroup,
  onSelectDevice,
  onSelectGroup,
}: Props) {
  const [tab, setTab] = useState<'devices' | 'groups'>('devices')
  const unassigned = devices.filter((d) => d.status === 'unassigned')
  const assigned = devices.filter((d) => d.status !== 'unassigned')

  const sorted = [...unassigned, ...assigned]

  return (
    <div role="region" aria-label="Devices and groups">
      <div role="tablist" style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--p-line)', marginBottom: 16 }}>
        <button
          role="tab"
          aria-selected={tab === 'devices'}
          onClick={() => setTab('devices')}
          style={{
            padding: '8px 14px',
            fontSize: 13,
            fontWeight: 600,
            color: tab === 'devices' ? 'var(--p-ink)' : 'var(--p-sub)',
            cursor: 'pointer',
            borderBottom: tab === 'devices' ? '2px solid var(--p-acc)' : '2px solid transparent',
            marginBottom: -1,
            background: 'transparent',
            border: 'none',
          }}
        >
          Devices · {devices.length}
        </button>
        <button
          role="tab"
          aria-selected={tab === 'groups'}
          onClick={() => setTab('groups')}
          style={{
            padding: '8px 14px',
            fontSize: 13,
            fontWeight: 600,
            color: tab === 'groups' ? 'var(--p-ink)' : 'var(--p-sub)',
            cursor: 'pointer',
            borderBottom: tab === 'groups' ? '2px solid var(--p-acc)' : '2px solid transparent',
            marginBottom: -1,
            background: 'transparent',
            border: 'none',
          }}
        >
          Groups · {groups.length}
        </button>
      </div>

      {/* Devices tab */}
      <div role="tabpanel" style={{ display: tab === 'devices' ? 'block' : 'none' }}>
        {sorted.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--p-sub)', fontSize: 13 }}>
            No devices yet.
          </div>
        ) : (
          <div className="p-device-list">
            {sorted.map((d) => {
              const chip = statusChip(d.status)
              const owner = ownerName(kids, d.owner_ids)
              const deviceType = getDeviceType(d.name, d.vendor)
              const isSelected = selectedDevice === d.id
              const isUnassigned = d.status === 'unassigned'

              return (
                <button
                  key={d.id}
                  className="p-device-item"
                  data-device={d.id}
                  data-selected={isSelected}
                  data-unassigned={isUnassigned}
                  onClick={() => onSelectDevice(d.id)}
                  style={{
                    cursor: 'pointer',
                  }}
                >
                  <div className="p-device-icon">
                    <Icon name={DEVICE_TYPE_ICON[deviceType]} size={18} />
                  </div>
                  <div className="p-device-info">
                    <div className="p-device-name">{d.name}</div>
                    <div className="p-device-meta">
                      {owner} · {relativeTime(d.last_seen)}
                    </div>
                  </div>
                  <div className="p-chip" data-tone={chip.tone}>
                    <Icon name={chip.icon} size={12} />
                    {chip.text}
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Groups tab */}
      <div role="tabpanel" style={{ display: tab === 'groups' ? 'block' : 'none' }}>
        {groups.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--p-sub)', fontSize: 13 }}>
            No groups yet.
          </div>
        ) : (
          <div className="p-device-list">
            {groups.map((g) => {
              const groupOwners = ownerName(kids, g.owner_ids ?? [])
              const deviceTypes = getGroupDeviceTypes(devices, g.device_ids)
              const isSelected = selectedGroup === g.id
              const firstDevice = devices.find((d) => d.id === g.device_ids[0])
              const firstType = firstDevice ? getDeviceType(firstDevice.name, firstDevice.vendor) : 'other'

              return (
                <button
                  key={g.id}
                  className="p-device-item"
                  data-group={g.id}
                  data-selected={isSelected}
                  onClick={() => onSelectGroup?.(g.id)}
                  style={{
                    cursor: 'pointer',
                  }}
                >
                  <div className="p-device-icon">
                    <Icon name={DEVICE_TYPE_ICON[firstType]} size={18} />
                  </div>
                  <div className="p-device-info">
                    <div className="p-device-name">{g.name}</div>
                    <div className="p-device-meta">
                      {g.device_ids.length} {g.device_ids.length === 1 ? 'device' : 'devices'} · {groupOwners}
                    </div>
                  </div>
                  <div className="p-group-stack">
                    {deviceTypes.map((type) => (
                      <Icon key={type} name={DEVICE_TYPE_ICON[type]} size={16} />
                    ))}
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
