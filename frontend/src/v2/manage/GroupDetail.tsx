import { Button, Text, TextInput } from '@mantine/core'
import { HeaderChips } from '@/v2/parent/HeaderChips'
import { HoursTimeline } from './HoursTimeline'
import type { Device, Group, Kid, TimeWindow } from '@/v2/types'

interface Props {
  group: Group
  devices: Device[]
  kids: Kid[]
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

const lockedCount = (devices: Device[]) => {
  const groupDevices = devices.filter((d) => d.group_ids?.includes(0))
  return groupDevices.filter((d) => d.status === 'locked').length
}

export function GroupDetail({ group, devices, kids, windows, onClose, onRequestOverride }: Props) {
  const groupDevices = devices.filter((d) => group.device_ids.includes(d.id))
  const locked = groupDevices.filter((d) => d.override?.action === 'lock').length

  const headerChips = [
    { text: `${groupDevices.length} devices` },
    { text: `${locked} locked` },
    { text: ownerNames(kids, group.owner_ids) },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 16, padding: 16 }}>
      <div>
        <Text weight={600} size="lg" mb="xs">
          {group.name}
        </Text>
        <HeaderChips items={headerChips} />
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <Button
          data-variant="red"
          onClick={() => onRequestOverride({ kind: 'group', id: group.id, action: 'lock' })}
        >
          Lock group
        </Button>
        <Button
          data-variant="ghost"
          onClick={() => onRequestOverride({ kind: 'group', id: group.id, action: 'unlock' })}
        >
          Unlock 30 min
        </Button>
        <Button
          data-variant="ghost"
          onClick={() => onRequestOverride({ kind: 'group', id: group.id, action: 'schedule' })}
        >
          Back to schedule
        </Button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <Text weight={500} size="sm" mb={4}>
              Group name
            </Text>
            <TextInput value={group.name} readOnly />
          </div>

          <div>
            <Text weight={500} size="sm" mb={4}>
              Devices in group
            </Text>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {groupDevices.map((d) => (
                <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text>{d.name}</Text>
                  <Button size="xs" variant="subtle" onClick={() => {}}>
                    Remove
                  </Button>
                </div>
              ))}
            </div>
            <Button mt="md" variant="ghost" onClick={() => {}}>
              Add a device
            </Button>
          </div>

          {windows && (
            <div>
              <Text weight={500} size="sm" mb={4}>
                Hours for {group.name}
              </Text>
              <HoursTimeline label={`Hours for ${group.name}`} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
