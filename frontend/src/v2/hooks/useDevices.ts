import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/v2/api'
import { toastFail, toastOk } from '@/v2/notify'
import type { BlockerStatus, Device, DeviceStatus, Group } from '@/v2/types'

export interface DevicePatch {
  name?: string
  status?: DeviceStatus
  owner_ids?: number[]
  group_ids?: number[]
}

// polled so a second tab, an expired override or a new device shows up without a reload
const poll = { refetchInterval: 15_000, refetchIntervalInBackground: false }
export const useDevices = () => useQuery({ queryKey: ['devices'], queryFn: () => api<Device[]>('/devices'), ...poll })
export const useBlocker = () =>
  useQuery({ queryKey: ['blocker'], queryFn: () => api<BlockerStatus>('/blocker'), refetchInterval: 30_000, refetchIntervalInBackground: false })
export const useGroups = () => useQuery({ queryKey: ['groups'], queryFn: () => api<Group[]>('/groups'), ...poll })

/**
 * True once `iso` has passed. Re-renders and refetches devices at that moment, so an
 * "Unlock 30 min" that runs out while the screen is open flips back to "on schedule".
 */
export function useExpired(iso: string | null | undefined): boolean {
  const qc = useQueryClient()
  const at = iso ? new Date(iso).getTime() : 0
  const [, tick] = useState(0)
  useEffect(() => {
    if (!at) return
    const wait = at - Date.now()
    if (wait > 2 ** 31 - 1) return
    const t = setTimeout(() => {
      tick((n) => n + 1)
      qc.invalidateQueries({ queryKey: ['devices'] })
    }, Math.max(wait, 0) + 500)
    return () => clearTimeout(t)
  }, [at, qc])
  return !!at && at <= Date.now()
}

/** Run a mutation then refresh devices, groups and today. */
function useRefreshing<V>(fn: (v: V) => Promise<unknown>, done?: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onError: done ? toastFail : undefined,
    onSuccess: () => {
      if (done) toastOk(done)
      return Promise.all(['devices', 'groups', 'today'].map((k) => qc.invalidateQueries({ queryKey: [k] })))
    },
  })
}

export const usePatchDevice = () =>
  useRefreshing(({ id, patch }: { id: number; patch: DevicePatch }) =>
    api(`/devices/${id}`, { method: 'PATCH', body: patch }),
  )
export const useTestBlock = () =>
  useMutation({
    mutationFn: (id: number) => api<{ reason: string; message: string }>(`/devices/${id}/test-block`, { method: 'POST' }),
  })
export const useDeleteDevice = () => useRefreshing((id: number) => api(`/devices/${id}`, { method: 'DELETE' }), 'Deleted')
export const useSaveGroup = () =>
  useRefreshing(({ id, ...body }: { id?: number; name: string; device_ids: number[]; icon?: string; chore_lock?: boolean }) =>
    id ? api(`/groups/${id}`, { method: 'PATCH', body }) : api('/groups', { method: 'POST', body }),
  )
export const useDeleteGroup = () => useRefreshing((id: number) => api(`/groups/${id}`, { method: 'DELETE' }), 'Deleted')
