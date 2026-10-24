import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../api'
import type { Today } from '../types'

/** GET /today, refreshed every 15 s and on window focus. */
export const useToday = () =>
  useQuery({
    queryKey: ['today'],
    queryFn: () => api<Today>('/today'),
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  })

function useChoreAction<V>(fn: (v: V) => Promise<unknown>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () =>
      Promise.all([qc.invalidateQueries({ queryKey: ['today'] }), qc.invalidateQueries({ queryKey: ['chores-today'] })]),
  })
}

export const useApproveChore = () =>
  useChoreAction((id: number) => api(`/chores/${id}/approve`, { method: 'POST' }))

export const useSendBack = () =>
  useChoreAction(({ id, note }: { id: number; note: string }) =>
    api(`/chores/${id}/send-back`, { method: 'POST', body: { note } }),
  )
