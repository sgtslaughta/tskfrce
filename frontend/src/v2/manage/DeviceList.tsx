import { useState } from 'react'
import { Icon } from '@/v2/parent/Icon'
import { MakerLogo } from '@/v2/parent/MakerLogo'
import { Chip, type ChipTone } from '@/v2/parent/Chip'
import { ListHeader } from '@/v2/parent/ListHeader'
import { SegmentedControl } from '@/v2/parent/SegmentedControl'
import type { Device, Group as DeviceGroup, Kid } from '@/v2/types'
import { DEVICE_TYPE_ICON, getDeviceType, type DeviceType } from './deviceMeta'

interface Props {
  devices: Device[]
  kids: Kid[]
  groups?: DeviceGroup[]
  selectedDevice?: number | null
  selectedGroup?: number | 'new' | null
  onSelectDevice: (id: number) => void
  onSelectGroup?: (id: number | 'new') => void
  tab?: 'devices' | 'groups'
  onTabChange?: (tab: 'devices' | 'groups') => void
}

const statusChip = (status: string): { tone: ChipTone; text: string; icon: string } => {
  if (status === 'open' || status === 'assigned') return { tone: 'acc', text: 'Open', icon: 'lock_open' }
  if (status === 'locked') return { tone: 'grey', text: 'Locked', icon: 'lock' }
  if (status === 'exempt') return { tone: 'lav', text: 'Exempt', icon: 'shield' }
  if (status === 'guest') return { tone: 'grey', text: 'Guest', icon: 'person' }
  return { tone: 'amb', text: "Who's this?", icon: 'help' }
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
  tab: propTab = 'devices',
  onTabChange,
}: Props) {
  const [tab, setTab] = useState<'devices' | 'groups'>(propTab)

  const handleTabChange = (newTab: 'devices' | 'groups') => {
    setTab(newTab)
    onTabChange?.(newTab)
  }
  const unassigned = devices.filter((d) => d.status === 'unassigned')
  const assigned = devices.filter((d) => d.status !== 'unassigned')

  const sorted = [...unassigned, ...assigned]

  return (
    <div role="region" aria-label="Devices and groups">
      <ListHeader title={tab === 'devices' ? 'Devices' : 'Groups'}>
        <SegmentedControl
          value={tab}
          onChange={handleTabChange}
          options={[
            { value: 'devices', label: `Devices · ${devices.length}` },
            { value: 'groups', label: `Groups · ${groups.length}` },
          ]}
        />
      </ListHeader>

      <div className="p-list-items">
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
                      {d.vendor && (
                        <div className="p-device-vendor">
                          <MakerLogo vendor={d.vendor} size={12} />
                        </div>
                      )}
                    </div>
                    <div className="p-device-info">
                      <div className="p-device-name" title={d.name}>{d.name}</div>
                      <div className="p-device-meta">
                        {owner} · {relativeTime(d.last_seen)}
                      </div>
                    </div>
                    <Chip tone={chip.tone} icon={chip.icon}>
                      {chip.text}
                    </Chip>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Groups tab */}
        <div role="tabpanel" style={{ display: tab === 'groups' ? 'block' : 'none' }}>
          <div className="p-device-list">
              {groups.length === 0 && <p className="pk-hint pk-empty">No groups yet. Make one to set hours for several devices at once.</p>}
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
              <button type="button" className="pk-card pk-new" data-selected={selectedGroup === 'new'} onClick={() => onSelectGroup?.('new')}>
                <Icon name="add" size={18} />
                New group
              </button>
          </div>
        </div>
      </div>
    </div>
  )
}
