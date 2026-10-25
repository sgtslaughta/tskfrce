import { useRouter } from 'next/router'
import { useCallback } from 'react'
import type { Device, Group, Kid } from '@/v2/types'
import { DeviceList } from './DeviceList'

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)

export function DevicesSection({
  devices,
  kids,
  groups = [],
  focus,
  tab = 'devices',
  onTabChange,
}: {
  devices: Device[]
  kids: Kid[]
  groups?: Group[]
  focus: number
  tab?: 'devices' | 'groups'
  onTabChange?: (tab: 'devices' | 'groups') => void
}) {
  const router = useRouter()
  const item = first(router.query.item)
  const selectedId = item === 'new' ? ('new' as const) : Number(item) || focus || null

  const handleSelectDevice = useCallback(
    (id: number) => {
      router.push({ pathname: router.pathname, query: { ...router.query, item: id } }, undefined, { shallow: true })
      onTabChange?.('devices')
    },
    [router, onTabChange],
  )

  const handleSelectGroup = useCallback(
    (id: number | 'new') => {
      router.push({ pathname: router.pathname, query: { ...router.query, item: id } }, undefined, { shallow: true })
      onTabChange?.('groups')
    },
    [router, onTabChange],
  )

  return (
    <DeviceList
      devices={devices}
      kids={kids}
      groups={groups}
      selectedDevice={selectedId === 'new' ? null : selectedId}
      selectedGroup={selectedId}
      onSelectDevice={handleSelectDevice}
      onSelectGroup={handleSelectGroup}
      tab={tab}
      onTabChange={onTabChange}
    />
  )
}
