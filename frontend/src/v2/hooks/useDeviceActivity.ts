import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/v2/api'
import { toastFail } from '@/v2/notify'
import type { DeviceActivity } from '@/v2/types'

export const useDeviceActivity = (id: number) =>
  useQuery({
    queryKey: ['device-activity', id],
    queryFn: () => api<DeviceActivity>(`/devices/${id}/activity`),
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  })

function useActivityMutation<V>(fn: (v: V) => Promise<unknown>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onError: toastFail,
    onSuccess: () => Promise.all(['device-activity', 'devices'].map((k) => qc.invalidateQueries({ queryKey: [k] }))),
  })
}

type Ev = { deviceId: number; eventId: number }

export const useMarkOk = () =>
  useActivityMutation(({ deviceId, eventId }: Ev) => api(`/devices/${deviceId}/events/${eventId}/ok`, { method: 'POST' }))
export const useMergeDevice = () =>
  useActivityMutation(({ deviceId, eventId }: Ev) => api(`/devices/${deviceId}/events/${eventId}/merge`, { method: 'POST' }))
/** Lock all of a kid's devices, or `clear` the override (back on schedule). */
export const useLockKid = () =>
  useActivityMutation(({ kidId, action }: { kidId: number; action: 'lock' | 'clear' }) =>
    action === 'clear'
      ? api(`/kids/${kidId}/override`, { method: 'DELETE' })
      : api(`/kids/${kidId}/override`, { method: 'POST', body: { action } }),
  )
