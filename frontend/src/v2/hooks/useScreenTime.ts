import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/v2/api'
import type { ScreenTime } from '@/v2/types'

export interface ScreenPatch {
  enabled?: boolean
  price?: number
  /** null clears the daily max */
  max_minutes_per_day?: number | null
  auto_approve?: boolean
  only_in_allowed_hours?: boolean
}

export interface LimitBody {
  max_minutes: number | null
  min_points: number | null
}

export const useScreenTime = () => useQuery({ queryKey: ['screen-time'], queryFn: () => api<ScreenTime>('/screen-time') })

function useScreenMutation<V>(fn: (v: V) => Promise<unknown>) {
  const qc = useQueryClient()
  return useMutation({ mutationFn: fn, onSuccess: () => qc.invalidateQueries({ queryKey: ['screen-time'] }) })
}

export const usePatchScreenTime = () =>
  useScreenMutation((body: ScreenPatch) => api<ScreenTime>('/screen-time', { method: 'PATCH', body }))

export const useSetLimit = () =>
  useScreenMutation(({ kidId, body }: { kidId: number; body: LimitBody }) =>
    api<ScreenTime>(`/screen-time/limits/${kidId}`, { method: 'PUT', body }),
  )

export const useDeleteLimit = () =>
  useScreenMutation((kidId: number) => api(`/screen-time/limits/${kidId}`, { method: 'DELETE' }))
