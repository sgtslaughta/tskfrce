import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../api'
import type { Today } from '../types'

/** GET /today, refreshed every 15 s and on window focus. */
export const useToday = (enabled = true) =>
  useQuery({
    enabled,
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
      Promise.all(
        ['today', 'chore-lib', 'chores-today', 'run', 'chat-thread', 'chat-threads'].map((k) => qc.invalidateQueries({ queryKey: [k] })),
      ),
  })
}

export const useApproveChore = () =>
  useChoreAction((id: number) => api(`/chores/${id}/approve`, { method: 'POST' }))

export const useMarkDone = () =>
  useChoreAction((id: number) => api(`/chores/${id}/done`, { method: 'POST' }))

export const useMarkNotDone = () =>
  useChoreAction((id: number) => api(`/chores/${id}/undo`, { method: 'POST' }))

export const useSendBack = () =>
  useChoreAction(({ id, note }: { id: number; note: string }) =>
    api(`/chores/${id}/send-back`, { method: 'POST', body: { note } }),
  )

export const useMoveChore = () => useChoreAction((id: number) => api(`/chores/${id}/move`, { method: 'POST' }))
/** Skip today; Undo (useMarkNotDone) un-skips. */
export const useSkipChore = () => useChoreAction((id: number) => api(`/chores/${id}/skip`, { method: 'POST' }))
export const useDeductChore = () =>
  useChoreAction(({ id, ...body }: { id: number; kid_id: number; amount: number; note?: string }) =>
    api(`/chores/${id}/deduct`, { method: 'POST', body }),
  )
