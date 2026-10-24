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
}: {
  devices: Device[]
  kids: Kid[]
  groups?: Group[]
  focus: number
}) {
  const router = useRouter()
  const selectedId = Number(first(router.query.item)) || null

  const handleSelectDevice = useCallback(
    (id: number) => {
      router.push({ pathname: router.pathname, query: { ...router.query, item: id } }, undefined, { shallow: true })
    },
    [router],
  )

  const handleSelectGroup = useCallback(
    (id: number) => {
      router.push({ pathname: router.pathname, query: { ...router.query, item: id } }, undefined, { shallow: true })
    },
    [router],
  )

  return (
    <DeviceList
      devices={devices}
      kids={kids}
      groups={groups}
      selectedDevice={selectedId}
      onSelectDevice={handleSelectDevice}
      onSelectGroup={handleSelectGroup}
    />
  )
}
