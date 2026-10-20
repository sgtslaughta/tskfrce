import { useRouter } from 'next/router'
import { Text } from '@mantine/core'
import { FridgeShell } from '@/v2/components/FridgeShell'
import { RequireParent } from '@/v2/components/RequireParent'
import { useDevices } from '@/v2/hooks/useDevices'
import { useKids } from '@/v2/hooks/useKids'
import type { Device } from '@/v2/types'
import { DeviceRow } from './DeviceRow'
import { GroupsPanel } from './GroupsPanel'

const SECTIONS: { status: Device['status']; title: string }[] = [
  { status: 'unassigned', title: 'New (blocked until you assign them)' },
  { status: 'assigned', title: 'Assigned' },
  { status: 'guest', title: 'Guests (always online)' },
]

export function DevicesPage() {
  const router = useRouter()
  const focus = Number(router.query.focus)
  const devices = useDevices()
  const kids = useKids()
  const all = devices.data ?? []

  return (
    <RequireParent>
      <FridgeShell title="Devices">
        {devices.isError && <Text role="alert">{devices.error.message}</Text>}
        {SECTIONS.map(({ status, title }) => {
          const rows = all.filter((d) => d.status === status)
          return (
            <section key={status} aria-label={title}>
              <h2 className="f-display">{title}</h2>
              {rows.length === 0 && <Text>None.</Text>}
              {rows.map((d) => (
                <DeviceRow key={d.id} device={d} kids={kids.data ?? []} focused={d.id === focus} />
              ))}
            </section>
          )
        })}
        <GroupsPanel devices={all} />
      </FridgeShell>
    </RequireParent>
  )
}
