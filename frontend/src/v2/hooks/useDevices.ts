import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/v2/api'
import { toastFail, toastOk } from '@/v2/notify'
import type { Device, DeviceStatus, Group } from '@/v2/types'

export interface DevicePatch {
  name?: string
  status?: DeviceStatus
  owner_ids?: number[]
  group_ids?: number[]
}

export const useDevices = () => useQuery({ queryKey: ['devices'], queryFn: () => api<Device[]>('/devices') })
export const useGroups = () => useQuery({ queryKey: ['groups'], queryFn: () => api<Group[]>('/groups') })

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
  useRefreshing(({ id, name, device_ids }: { id?: number; name: string; device_ids: number[] }) =>
    id
      ? api(`/groups/${id}`, { method: 'PATCH', body: { name, device_ids } })
      : api('/groups', { method: 'POST', body: { name, device_ids } }),
  )
export const useDeleteGroup = () => useRefreshing((id: number) => api(`/groups/${id}`, { method: 'DELETE' }), 'Deleted')
