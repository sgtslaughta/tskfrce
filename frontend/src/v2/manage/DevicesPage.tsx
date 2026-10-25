import { useEffect } from 'react'
import { useRouter } from 'next/router'
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
import { useSingleFlight } from './useSingleFlight'

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)

function DevicesBody() {
  const { query } = useRouter()
  const router = useRouter()
  const devices = useDevices()
  const kids = useKids()
  const groups = useGroups()
  const windows = useWindows()
  const all = devices.data ?? []
  // the tab lives in the URL: device and group ids overlap, so ?item alone can't say which one it is
  const tab = first(query.tab) === 'groups' ? 'groups' : 'devices'
  const setTab = (t: 'devices' | 'groups') => {
    const { item: _drop, tab: _t, ...rest } = query
    router.push({ pathname: router.pathname, query: t === 'groups' ? { ...rest, tab: t } : rest }, undefined, { shallow: true })
  }
  const small = useMediaQuery('(max-width: 767px)')
  // desktop opens the first item rather than an empty detail pane; phone stays on the list
  const shown = tab === 'devices' ? all : groups.data ?? []
  const fallback = small ? null : (shown[0]?.id ?? null)
  const item = first(query.item)
  const creating = item === 'new' && tab === 'groups'
  // a stale ?item (just deleted) falls back instead of leaving the pane blank
  const selectedId = shown.some((x) => x.id === Number(item)) ? Number(item) : fallback
  const loaded = tab === 'devices' ? !!devices.data : !!groups.data
  const stale = !!item && item !== 'new' && loaded && !shown.some((x) => x.id === Number(item))
  // a deleted item's id (from another tab, or this one) shouldn't linger in the URL where a reused id could reopen it
  useEffect(() => {
    if (!stale) return
    const { item: _drop, ...rest } = query
    router.replace({ pathname: router.pathname, query: rest }, undefined, { shallow: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stale])
  // select a group (or null = drop ?item so the first item reopens)
  const pick = (id: number | null) => {
    const { item: _drop, ...rest } = query
    router.push({ pathname: router.pathname, query: id === null ? rest : { ...rest, item: id } }, undefined, { shallow: true })
  }

  const selectedDevice = all.find((d) => d.id === selectedId && tab === 'devices')
  const selectedGroup = (groups.data ?? []).find((g) => g.id === selectedId && tab === 'groups' && !creating)

  const override = useOverride()
  const once = useSingleFlight()
  // detail buttons: lock until changed, unlock for 30 min, "schedule" = clear the override
  const handleRequestOverride = (req: { kind: string; id: number; action: string }) =>
    once((settled) => override.mutate({
      target: { kind: req.kind as OverrideTarget['kind'], id: req.id },
      choice: req.action === 'lock' ? { action: 'lock', minutes: null }
        : req.action === 'unlock' ? { action: 'unlock', minutes: 30 }
        : { action: 'clear' },
    }, settled))

  // the action in flight (lock / unlock / clear): the pressed button shows a spinner
  const pending = override.isPending ? override.variables.choice.action : null

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
          key={selectedDevice.id}
          device={selectedDevice}
          kids={kids.data ?? []}
          groups={groups.data ?? []}
          onDeleted={() => pick(null)}
          onRequestOverride={handleRequestOverride}
          pendingAction={pending}
        />
      )}
      {!devices.isError && (selectedGroup || creating) && (
        <GroupDetail
          key={selectedGroup?.id ?? 'new'}
          group={selectedGroup}
          devices={all}
          kids={kids.data ?? []}
          groups={groups.data ?? []}
          windows={windows.data ?? []}
          onSelect={pick}
          onRequestOverride={handleRequestOverride}
          pendingAction={pending}
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
