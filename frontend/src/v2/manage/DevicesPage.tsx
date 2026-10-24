import { useRouter } from 'next/router'
import { useCallback, useState } from 'react'
import { ParentShell } from '@/v2/parent/ParentShell'
import { LoadError, LoadingCards } from '@/v2/components/States'
import { RequireParent } from '@/v2/components/RequireParent'
import { useDevices, useGroups } from '@/v2/hooks/useDevices'
import { useKids } from '@/v2/hooks/useKids'
import { useWindows } from '@/v2/hooks/useWindows'
import { DevicesSection } from './DevicesSection'
import { DeviceDetail } from './DeviceDetail'
import { GroupDetail } from './GroupDetail'

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)

function DevicesBody() {
  const { query } = useRouter()
  const devices = useDevices()
  const kids = useKids()
  const groups = useGroups()
  const windows = useWindows()
  const all = devices.data ?? []
  const selectedId = Number(first(query.item)) || null
  const [tab, setTab] = useState<'devices' | 'groups'>('devices')

  const selectedDevice = all.find((d) => d.id === selectedId && tab === 'devices')
  const selectedGroup = (groups.data ?? []).find((g) => g.id === selectedId && tab === 'groups')

  const handleRequestOverride = useCallback(
    (req: { kind: string; id: number; action: string }) => {
      console.log('Override requested:', req)
      // This will be implemented by the parent component
    },
    [],
  )

  return (
    <ParentShell
      title="Devices"
      list={
        devices.isPending ? (
          <LoadingCards />
        ) : (
          <DevicesSection devices={all} kids={kids.data ?? []} groups={groups.data ?? []} focus={selectedId ?? 0} />
        )
      }
    >
      {devices.isError && <LoadError error={devices.error} onRetry={() => devices.refetch()} />}
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
