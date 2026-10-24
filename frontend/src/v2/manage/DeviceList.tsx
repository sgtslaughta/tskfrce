import { Button, Group, Tabs, Text } from '@mantine/core'
import { MakerLogo } from '@/v2/parent/MakerLogo'
import { Chip } from '@/v2/parent/Chip'
import type { Device, Kid } from '@/v2/types'

interface Props {
  devices: Device[]
  kids: Kid[]
  selectedDevice?: number | null
  onSelectDevice: (id: number) => void
}

const statusChip = (status: string) => {
  if (status === 'open' || status === 'assigned') return { tone: 'acc' as const, text: 'Open' }
  if (status === 'locked') return { tone: 'grey' as const, text: 'Locked' }
  if (status === 'exempt') return { tone: 'lav' as const, text: 'Exempt' }
  if (status === 'guest') return { tone: 'grey' as const, text: 'Guest' }
  return { tone: 'amb' as const, text: "Who's this?" }
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

export function DeviceList({ devices, kids, selectedDevice, onSelectDevice }: Props) {
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
            Groups · 0
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
                        <Text weight={500}>{d.name}</Text>
                        <Text size="sm" color="dimmed">
                          {owner} · {relativeTime(d.last_seen)}
                        </Text>
                      </div>
                    </Group>
                    <Chip tone={chip.tone} icon={chip.text === "Who's this?" ? 'help' : 'check'}>
                      {chip.text === "Who's this?" ? "Who's this?" : chip.text}
                    </Chip>
                  </Button>
                )
              })}
            </div>
          )}
        </Tabs.Panel>

        <Tabs.Panel value="groups" pt="md">
          <Text>Groups coming soon.</Text>
        </Tabs.Panel>
      </Tabs>
    </div>
  )
}
