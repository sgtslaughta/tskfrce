import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/v2/api'
import type { TimeWindow } from '@/v2/types'

export interface WindowBody {
  kind: 'allowed' | 'free'
  days: string
  start: string
  end: string
  kid_id?: number
  group_id?: number
}

export const useWindows = () => useQuery({ queryKey: ['windows'], queryFn: () => api<TimeWindow[]>('/windows') })

function useWindowMutation<V>(fn: (v: V) => Promise<unknown>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => Promise.all(['windows', 'today'].map((k) => qc.invalidateQueries({ queryKey: [k] }))),
  })
}

export const useAddWindow = () => useWindowMutation((body: WindowBody) => api('/windows', { method: 'POST', body }))
export const useDeleteWindow = () => useWindowMutation((id: number) => api(`/windows/${id}`, { method: 'DELETE' }))
