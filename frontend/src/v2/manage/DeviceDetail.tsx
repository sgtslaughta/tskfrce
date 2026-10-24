import { useState } from 'react'
import { Button, Tabs, Text, TextInput } from '@mantine/core'
import { HeaderChips } from '@/v2/parent/HeaderChips'
import { Chip } from '@/v2/parent/Chip'
import { Icon } from '@/v2/parent/Icon'
import { isPrivateMac } from './privateMac'
import type { Device, Kid } from '@/v2/types'

interface Props {
  device: Device
  kids: Kid[]
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

  const headerChips = [
    ...(device.vendor ? [{ text: device.vendor, logo: device.vendor }] : []),
    {
      text: device.online ? 'Online now' : `Last seen ${relativeTime(device.last_seen)}`,
      tone: device.online ? 'acc' : 'plain',
    },
    ...(device.ip ? [{ text: device.ip, tone: 'mono' }] : []),
    { text: ownerName(kids, device.owner_ids) },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 16, padding: 16 }}>
      <div>
        <Text weight={600} size="lg" mb="xs">
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

      <Tabs value={tab} onTabChange={setTab}>
        <Tabs.List>
          <Tabs.Tab value="overview" role="tab">
            Overview
          </Tabs.Tab>
          <Tabs.Tab value="network" role="tab">
            Network
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="overview" pt="md">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <Text weight={500} size="sm" mb={4}>
                Details
              </Text>
              <TextInput label="Name" value={device.name} readOnly />
              <TextInput label="Owners" value={ownerName(kids, device.owner_ids)} readOnly mt="xs" />
            </div>
            <div>
              <Text weight={500} size="sm" mb={4}>
                Right now
              </Text>
              <Text>
                Status: {device.status === 'guest' ? 'Guest' : device.online ? 'Online' : 'Offline'}
              </Text>
              {device.override && <Text>Override: {device.override.action}</Text>}
            </div>
          </div>
        </Tabs.Panel>

        <Tabs.Panel value="network" pt="md">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {device.ip && <TextInput label="IPv4" value={device.ip} readOnly />}
            {device.ipv6 && device.ipv6.length > 0 && (
              <div>
                <Text weight={500} size="sm" mb={4}>
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
