import { useRouter } from 'next/router'
import { Text } from '@mantine/core'
import { FridgeShell } from '@/v2/components/FridgeShell'
import { RequireParent } from '@/v2/components/RequireParent'
import { useDevices, useGroups } from '@/v2/hooks/useDevices'
import { useKids } from '@/v2/hooks/useKids'
import { DevicesSection } from './DevicesSection'
import { GroupsPanel } from './GroupsPanel'
import { ManageLayout, type SectionDef } from './ManageLayout'

type S = 'devices' | 'groups'
const DEVICE_SECTIONS: SectionDef<S>[] = [
  { id: 'devices', label: 'Devices' },
  { id: 'groups', label: 'Groups' },
]

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)

function DevicesBody() {
  const { query } = useRouter()
  const devices = useDevices()
  const kids = useKids()
  const groups = useGroups()
  const all = devices.data ?? []
  const want = first(query.section)
  const section: S = DEVICE_SECTIONS.some((s) => s.id === want) ? (want as S) : 'devices'

  return (
    <FridgeShell title="Devices">
      {devices.isError && <Text role="alert">{devices.error.message}</Text>}
      <ManageLayout path="/devices" sections={DEVICE_SECTIONS} section={section} counts={{ devices: all.length, groups: groups.data?.length }}>
        {section === 'devices' && <DevicesSection devices={all} kids={kids.data ?? []} focus={Number(first(query.focus))} />}
        {section === 'groups' && <GroupsPanel devices={all} />}
      </ManageLayout>
    </FridgeShell>
  )
}

export function DevicesPage() {
  return (
    <RequireParent>
      <DevicesBody />
    </RequireParent>
  )
}
