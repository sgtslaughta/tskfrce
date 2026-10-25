import { useRouter } from 'next/router'
import { useState } from 'react'
import { useMediaQuery } from '@mantine/hooks'
import { ParentShell } from '@/v2/parent/ParentShell'
import { EmptyState, ErrorPanel, Skeleton } from '@/v2/parent/states'
import { HELP_URL } from '@/v2/components/AccountMenu'
import { RequireParent } from '@/v2/components/RequireParent'
import { useDevices, useGroups } from '@/v2/hooks/useDevices'
import { useKids } from '@/v2/hooks/useKids'
import { useWindows } from '@/v2/hooks/useWindows'
import { useOverride, type OverrideTarget } from '@/v2/hooks/useOverride'
import { DevicesSection } from './DevicesSection'
import { DeviceDetail } from './DeviceDetail'
import { GroupDetail } from './GroupDetail'

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)

function DevicesBody() {
  const { query } = useRouter()
  const router = useRouter()
  const devices = useDevices()
  const kids = useKids()
  const groups = useGroups()
  const windows = useWindows()
  const all = devices.data ?? []
  const [tab, setTab] = useState<'devices' | 'groups'>('devices')
  const small = useMediaQuery('(max-width: 767px)')
  // desktop opens the first item rather than an empty detail pane; phone stays on the list
  const fallback = small ? null : ((tab === 'devices' ? all : groups.data ?? [])[0]?.id ?? null)
  const selectedId = Number(first(query.item)) || fallback

  const selectedDevice = all.find((d) => d.id === selectedId && tab === 'devices')
  const selectedGroup = (groups.data ?? []).find((g) => g.id === selectedId && tab === 'groups')

  const override = useOverride()
  // detail buttons: lock until changed, unlock for 30 min, "schedule" = clear the override
  const handleRequestOverride = (req: { kind: string; id: number; action: string }) =>
    override.mutate({
      target: { kind: req.kind as OverrideTarget['kind'], id: req.id },
      choice: req.action === 'lock' ? { action: 'lock', minutes: null }
        : req.action === 'unlock' ? { action: 'unlock', minutes: 30 }
        : { action: 'clear' },
    })

  return (
    <ParentShell
      title="Devices"
      list={
        devices.isPending ? (
          <Skeleton />
        ) : (
          <DevicesSection
            devices={all}
            kids={kids.data ?? []}
            groups={groups.data ?? []}
            focus={selectedId ?? 0}
            tab={tab}
            onTabChange={setTab}
          />
        )
      }
    >
      {devices.isError && <ErrorPanel kind="unreachable" error={devices.error} onRetry={() => devices.refetch()} />}
      {devices.data?.length === 0 && (
        <EmptyState
          icon="wifi_find"
          title="Looking for devices…"
          body="Turn on a kid's tablet and open a web page. It'll show up here."
          actions={[{ label: 'Not showing up?', icon: 'help', href: HELP_URL }]}
        />
      )}
      {!devices.isError && selectedDevice && (
        <DeviceDetail
          device={selectedDevice}
          kids={kids.data ?? []}
          groups={groups.data ?? []}
          isGroupOpen={tab === 'groups'}
          onClose={() => {}}
          onRequestOverride={handleRequestOverride}
        />
      )}
      {!devices.isError && selectedGroup && (
        <GroupDetail
          group={selectedGroup}
          devices={all}
          kids={kids.data ?? []}
          groups={groups.data ?? []}
          windows={windows.data ?? []}
          onClose={() => {}}
          onRequestOverride={handleRequestOverride}
        />
      )}
    </ParentShell>
  )
}

export function DevicesPage() {
  return (
    <RequireParent>
      <DevicesBody />
    </RequireParent>
  )
}
