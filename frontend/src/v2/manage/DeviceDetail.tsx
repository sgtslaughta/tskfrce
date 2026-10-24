import { useState } from 'react'
import { Button, Tabs, Text, TextInput, Switch } from '@mantine/core'
import { HeaderChips } from '@/v2/parent/HeaderChips'
import { Chip } from '@/v2/parent/Chip'
import { Icon } from '@/v2/parent/Icon'
import { isPrivateMac } from './privateMac'
import type { Device, Kid, Group } from '@/v2/types'

type HeaderChip = { text: string; vendor?: string; icon?: string; tone?: 'acc' | 'mono' | 'plain' }

interface Props {
  device: Device
  kids: Kid[]
  groups?: Group[]
  isGroupOpen: boolean
  onClose: () => void
  onRequestOverride: (req: { kind: string; id: number; action: string }) => void
}

const maskMac = (mac: string) => {
  if (mac.length < 17) return mac
  return mac.substring(0, 6) + '••:••' + mac.substring(11)
}

const relativeTime = (iso: string | null) => {
  if (!iso) return 'never'
  const date = new Date(iso)
  const now = new Date()
  const ms = now.getTime() - date.getTime()
  const mins = Math.floor(ms / 60000)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

const ownerName = (kids: Kid[], ownerIds: number[]) => {
  if (ownerIds.length === 0) return 'Unassigned'
  return kids
    .filter((k) => ownerIds.includes(k.id))
    .map((k) => k.full_name || k.username)
    .join(', ')
}

export function DeviceDetail({ device, kids, isGroupOpen, onClose, onRequestOverride }: Props) {
  const [tab, setTab] = useState<string | null>('overview')

  const headerChips: HeaderChip[] = [
    ...(device.vendor ? [{ text: device.vendor, vendor: device.vendor, icon: 'package' }] : []),
    {
      text: device.online ? 'Online now' : `Last seen ${relativeTime(device.last_seen)}`,
      tone: device.online ? ('acc' as const) : ('plain' as const),
      icon: device.online ? 'wifi' : 'clock',
    },
    ...(device.ip ? [{ text: device.ip, tone: 'mono' as const, icon: 'lan' }] : []),
    { text: ownerName(kids, device.owner_ids), icon: 'person' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 16, padding: 16 }}>
      <div>
        <Text fw={600} size="lg" mb="xs">
          {device.name}
        </Text>
        <HeaderChips items={headerChips} />
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <Button
          data-variant="red"
          onClick={() => onRequestOverride({ kind: 'device', id: device.id, action: 'lock' })}
        >
          Lock now
        </Button>
        <Button
          data-variant="ghost"
          onClick={() => onRequestOverride({ kind: 'device', id: device.id, action: 'unlock' })}
        >
          Unlock 30 min
        </Button>
      </div>

      <Tabs value={tab} onChange={setTab}>
        <Tabs.List>
          <Tabs.Tab value="overview" role="tab">
            Overview
          </Tabs.Tab>
          <Tabs.Tab value="network" role="tab">
            Network
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="overview" pt="md">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ padding: 12, border: '1px solid var(--p-line)', borderRadius: 8, backgroundColor: 'var(--p-soft)' }}>
              <Text fw={600} size="sm" mb={12}>
                Details
              </Text>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <Text size="xs" color="dimmed" mb={4} fw={500}>
                    Name
                  </Text>
                  <TextInput value={device.name} readOnly placeholder="—" />
                </div>
                <div>
                  <Text size="xs" color="dimmed" mb={4} fw={500}>
                    Owners
                  </Text>
                  <TextInput value={ownerName(kids, device.owner_ids)} readOnly placeholder="—" />
                </div>
                <div>
                  <Text size="xs" color="dimmed" mb={4} fw={500}>
                    Groups
                  </Text>
                  <TextInput
                    value={
                      groups
                        ?.filter((g) => device.group_ids.includes(g.id))
                        .map((g) => g.name)
                        .join(', ') || '—'
                    }
                    readOnly
                    placeholder="—"
                  />
                </div>
                <div style={{ paddingTop: 8 }}>
                  <Switch
                    label={<Text size="sm">Guest</Text>}
                    checked={device.status === 'guest'}
                    readOnly
                  />
                </div>
              </div>
            </div>

            <div style={{ padding: 12, border: '1px solid var(--p-line)', borderRadius: 8, backgroundColor: 'var(--p-soft)' }}>
              <Text fw={600} size="sm" mb={12}>
                Right now
              </Text>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div>
                  <Text size="xs" color="dimmed" mb={2} fw={500}>
                    Status
                  </Text>
                  <Text>
                    {device.status === 'guest' ? 'Guest' : device.online ? 'Online' : 'Offline'}
                  </Text>
                </div>
                {device.override && (
                  <div>
                    <Text size="xs" color="dimmed" mb={2} fw={500}>
                      Override
                    </Text>
                    <Text>{device.override.action}</Text>
                  </div>
                )}
                {device.override?.expires_at && (
                  <div>
                    <Text size="xs" color="dimmed" mb={2} fw={500}>
                      Expires at
                    </Text>
                    <Text>{new Date(device.override.expires_at).toLocaleString()}</Text>
                  </div>
                )}
              </div>
            </div>
          </div>
        </Tabs.Panel>

        <Tabs.Panel value="network" pt="md">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {device.ip && <TextInput label="IPv4" value={device.ip} readOnly />}
            {device.ipv6 && device.ipv6.length > 0 && (
              <div>
                <Text fw={500} size="sm" mb={4}>
                  IPv6
                </Text>
                {device.ipv6.map((ip, i) => (
                  <TextInput key={i} value={ip} readOnly mb="xs" />
                ))}
              </div>
            )}
            <TextInput label="MAC" value={maskMac(device.mac)} readOnly />
            {isPrivateMac(device.mac) && (
              <Chip tone="amb" icon="wifi">
                Yes, random
              </Chip>
            )}
            {device.hostname && <TextInput label="Hostname" value={device.hostname} readOnly />}
            {device.first_seen && (
              <TextInput label="First seen" value={new Date(device.first_seen).toLocaleDateString()} readOnly />
            )}
            {device.last_seen && (
              <TextInput label="Last seen" value={new Date(device.last_seen).toLocaleString()} readOnly />
            )}
          </div>
        </Tabs.Panel>
      </Tabs>
    </div>
  )
}
