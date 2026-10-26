import { useEffect, useRef } from 'react'
import { Chip } from '@/v2/parent/Chip'
import { Icon } from '@/v2/parent/Icon'
import { Fold } from '@/v2/parent/Fold'
import { MakerLogo } from '@/v2/parent/MakerLogo'
import { Tooltip } from '@mantine/core'
import { ListHeader } from '@/v2/parent/ListHeader'
import { SegmentedControl } from '@/v2/parent/SegmentedControl'
import type { Device, Group as DeviceGroup, Kid } from '@/v2/types'
import { ago, DEVICE_TYPE_ICON, getDeviceType, type DeviceType } from './deviceMeta'

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

type Tone = 'acc' | 'red' | 'amb' | 'grey'
/** What the device's internet is doing right now: a colour-coded glyph plus the words for its tooltip. */
const deviceState = (d: Device): { tone: Tone; tip: string; icon: string } => {
  // a lock you pressed beats the schedule; one that already ran out doesn't count
  const ov = d.override
  if (ov?.action === 'lock' && !(ov.expires_at && new Date(ov.expires_at).getTime() <= Date.now())) return { tone: 'red', tip: 'Locked by you', icon: 'lock' }
  if (d.exempt) return { tone: 'grey', tip: 'Exempt · always allowed', icon: 'verified_user' }
  if (d.status === 'unassigned') return { tone: 'amb', tip: "Who's this? New device, pick an owner", icon: 'help' }
  if (d.status === 'guest') return { tone: 'grey', tip: 'Guest · internet on', icon: 'person' }
  return d.online
    ? { tone: 'acc', tip: 'Internet on', icon: 'lock_open' }
    : { tone: 'red', tip: 'Internet off · hours or chores', icon: 'lock' }
}

const ownerName = (kids: Kid[], ownerIds: number[]) => {
  if (ownerIds.length === 0) return '—'
  return kids
    .filter((k) => ownerIds.includes(k.id))
    .map((k) => k.full_name || k.username)
    .join(', ')
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

/** Devices by owner: new ones first, then each kid, shared, guests, and nobody's. */
function byOwner(devices: Device[], kids: Kid[]) {
  const pick = (key: string, title: string, icon: string, list: Device[]) => ({ key, title, icon, list })
  const solo = (d: Device) => d.status === 'assigned' && d.owner_ids.length === 1
  return [
    pick('new', "Who's this?", 'help', devices.filter((d) => d.status === 'unassigned')),
    ...kids.map((k) => pick(`k${k.id}`, k.full_name || k.username, 'person', devices.filter((d) => solo(d) && d.owner_ids[0] === k.id))),
    pick('shared', 'Shared', 'group', devices.filter((d) => d.status === 'assigned' && d.owner_ids.length > 1)),
    pick('guest', 'Guests', 'badge', devices.filter((d) => d.status === 'guest')),
    pick('none', 'No owner', 'devices_other', devices.filter((d) => d.status === 'assigned' && (d.owner_ids.length === 0 || (solo(d) && !kids.some((k) => k.id === d.owner_ids[0]))))),
  ].filter((g) => g.list.length > 0)
}

export function DeviceList({
  devices,
  kids,
  groups = [],
  selectedDevice,
  selectedGroup,
  onSelectDevice,
  onSelectGroup,
  tab = 'devices',
  onTabChange,
}: Props) {
  const unassigned = devices.filter((d) => d.status === 'unassigned')
  const assigned = devices.filter((d) => d.status !== 'unassigned')

  const sorted = [...unassigned, ...assigned]
  const item = (d: Device) => {
    const state = deviceState(d)
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
        type="button"
        aria-current={isSelected || undefined}
        onClick={() => onSelectDevice(d.id)}
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
            <span>{owner} · {d.last_seen ? ago(d.last_seen) : 'never seen'}</span>
            {d.exempt && (
              <Chip tone="grey" icon="verified_user">
                Exempt
              </Chip>
            )}
          </div>
        </div>
        <Tooltip label={state.tip} openDelay={300}>
          <span className="p-device-state" data-tone={state.tone} role="img" aria-label={state.tip}>
            <Icon name={state.icon} size={16} />
          </span>
        </Tooltip>
      </button>
    )
  }
  // a deep link (?item=) or a pick from elsewhere may be off-screen in a long list
  const listRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[role="tabpanel"]:not([hidden]) [data-selected="true"]`)?.scrollIntoView({ block: 'nearest' })
  }, [selectedDevice, selectedGroup, tab, devices.length])

  return (
    <div role="region" aria-label="Devices and groups" ref={listRef}>
      <ListHeader title={tab === 'devices' ? 'Devices' : 'Groups'}>
        <SegmentedControl
          value={tab}
          onChange={(t) => onTabChange?.(t)}
          options={[
            { value: 'devices', label: `Devices · ${devices.length}` },
            { value: 'groups', label: `Groups · ${groups.length}` },
          ]}
        />
      </ListHeader>

      <div className="p-list-items">
        {/* Devices tab */}
        <div role="tabpanel" aria-label="Devices" hidden={tab !== 'devices'}>
          {sorted.length === 0 ? (
            <p className="p-device-empty">No devices yet.</p>
          ) : (
            <div className="p-device-list">
              {byOwner(sorted, kids).map((g) => (
                <Fold key={g.key} title={g.title} icon={g.icon} count={g.list.length} open={g.key === 'new' || g.list.some((d) => d.id === selectedDevice)}>
                  {g.list.map(item)}
                </Fold>
              ))}
            </div>
          )}
        </div>

        {/* Groups tab */}
        <div role="tabpanel" aria-label="Groups" hidden={tab !== 'groups'}>
          <div className="p-device-list">
              {groups.length === 0 && <p className="pk-hint pk-empty">No groups yet. Make one to set hours for several devices at once.</p>}
              {groups.map((g) => {
                const memberOwners = devices.filter((d) => g.device_ids.includes(d.id)).flatMap((d) => d.owner_ids)
                const groupOwners = ownerName(kids, memberOwners)
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
                    type="button"
                    aria-current={isSelected || undefined}
                    onClick={() => onSelectGroup?.(g.id)}
                  >
                    <div className="p-device-icon">
                      <Icon name={g.icon || DEVICE_TYPE_ICON[firstType]} size={18} />
                    </div>
                    <div className="p-device-info">
                      <div className="p-device-name" title={g.name}>{g.name}</div>
                      <div className="p-device-meta">
                        {g.device_ids.length} {g.device_ids.length === 1 ? 'device' : 'devices'} · {groupOwners}
                      </div>
                    </div>
                    <div className="p-group-stack" aria-hidden="true">
                      {deviceTypes.slice(0, 3).map((type) => (
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
