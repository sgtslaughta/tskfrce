import { Button, Group, Tabs, Text } from '@mantine/core'
import { MakerLogo } from '@/v2/parent/MakerLogo'
import { Chip } from '@/v2/parent/Chip'
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
  if (status === 'open' || status === 'assigned') return { tone: 'acc' as const, text: 'Open', icon: 'check' }
  if (status === 'locked') return { tone: 'grey' as const, text: 'Locked', icon: 'lock' }
  if (status === 'exempt') return { tone: 'lav' as const, text: 'Exempt', icon: 'shield' }
  if (status === 'guest') return { tone: 'grey' as const, text: 'Guest', icon: 'user' }
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
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return date.toLocaleDateString()
}

type DeviceType = 'phone' | 'console' | 'tv' | 'laptop' | 'other'

const DEVICE_TYPE_ICON: Record<DeviceType, string> = {
  phone: 'smartphone',
  console: 'sports_esports',
  tv: 'tv',
  laptop: 'laptop',
  other: 'device_unknown',
}

const getDeviceType = (name: string, vendor?: string | null): DeviceType => {
  const text = `${name} ${vendor ?? ''}`
  if (/xbox|playstation|\bps[345]\b|nintendo|switch|steam ?deck/i.test(text)) return 'console'
  if (/\btv\b|roku|chromecast|fire ?stick|apple ?tv|shield|bravia/i.test(text)) return 'tv'
  if (/laptop|macbook|chromebook|thinkpad|\bpc\b|desktop|imac/i.test(text)) return 'laptop'
  if (/phone|ipad|tablet|pixel|galaxy|kindle|android/i.test(text)) return 'phone'
  return 'other'
}

const getGroupDeviceTypes = (devices: Device[], groupDeviceIds: number[]): DeviceType[] => {
  const groupDevices = devices.filter((d) => groupDeviceIds.includes(d.id))
  const types = new Set<DeviceType>()
  groupDevices.forEach((d) => {
    types.add(getDeviceType(d.name, d.vendor))
  })
  return Array.from(types)
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
  const unassigned = devices.filter((d) => d.status === 'unassigned')
  const assigned = devices.filter((d) => d.status !== 'unassigned')

  const sorted = [...unassigned, ...assigned]

  return (
    <div role="region" aria-label="Devices and groups">
      <Tabs defaultValue="devices">
        <Tabs.List>
          <Tabs.Tab value="devices" role="tab">
            Devices · {devices.length}
          </Tabs.Tab>
          <Tabs.Tab value="groups" role="tab">
            Groups · {groups.length}
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="devices" pt="md">
          {sorted.length === 0 ? (
            <Text>No devices yet.</Text>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {sorted.map((d) => {
                const chip = statusChip(d.status)
                const owner = ownerName(kids, d.owner_ids)
                return (
                  <Button
                    key={d.id}
                    data-device={d.id}
                    variant="subtle"
                    justify="space-between"
                    onClick={() => onSelectDevice(d.id)}
                    style={{ textAlign: 'left', height: 'auto', padding: 12 }}
                  >
                    <Group gap="xs" style={{ flex: 1 }}>
                      <MakerLogo vendor={d.vendor} />
                      <div style={{ flex: 1 }}>
                        <Text fw={500}>{d.name}</Text>
                        <Text size="sm" color="dimmed">
                          {owner} · {relativeTime(d.last_seen)}
                        </Text>
                      </div>
                    </Group>
                    <Chip tone={chip.tone} icon={chip.icon}>
                      {chip.text}
                    </Chip>
                  </Button>
                )
              })}
            </div>
          )}
        </Tabs.Panel>

        <Tabs.Panel value="groups" pt="md">
          {groups.length === 0 ? (
            <Text>No groups yet.</Text>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {groups.map((g) => {
                const groupOwners = ownerName(kids, g.owner_ids)
                const deviceTypes = getGroupDeviceTypes(devices, g.device_ids)
                return (
                  <Button
                    key={g.id}
                    data-group={g.id}
                    variant="subtle"
                    justify="space-between"
                    onClick={() => onSelectGroup?.(g.id)}
                    style={{ textAlign: 'left', height: 'auto', padding: 12 }}
                  >
                    <Group gap="xs" style={{ flex: 1 }}>
                      <div style={{ flex: 1 }}>
                        <Text fw={500}>{g.name}</Text>
                        <Text size="sm" color="dimmed">
                          {g.device_ids.length} {g.device_ids.length === 1 ? 'device' : 'devices'} · {groupOwners}
                        </Text>
                      </div>
                    </Group>
                    <Group gap="xs">
                      <div style={{ display: 'flex', gap: -8, alignItems: 'center' }}>
                        {deviceTypes.map((type) => (
                          <Icon key={type} name={DEVICE_TYPE_ICON[type]} size={20} label={`${type} in group`} />
                        ))}
                      </div>
                    </Group>
                  </Button>
                )
              })}
            </div>
          )}
        </Tabs.Panel>
      </Tabs>
    </div>
  )
}
