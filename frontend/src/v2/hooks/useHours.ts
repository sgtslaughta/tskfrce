import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/v2/api'
import { toastFail } from '@/v2/notify'
import type { HoursPayload, RuleBody } from '@/v2/types'

export const useHours = () => useQuery({ queryKey: ['hours'], queryFn: () => api<HoursPayload>('/hours') })

function useRuleMutation<V>(fn: (v: V) => Promise<unknown>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onError: toastFail,
    onSuccess: () => Promise.all(['hours', 'devices', 'today'].map((k) => qc.invalidateQueries({ queryKey: [k] }))),
  })
}

/** POST a new rule, or PUT when `id` is given. */
export const useSaveRule = () =>
  useRuleMutation(({ id, body }: { id?: number; body: RuleBody }) =>
    id ? api(`/hours/${id}`, { method: 'PUT', body }) : api('/hours', { method: 'POST', body }),
  )
export const useDeleteRule = () => useRuleMutation((id: number) => api(`/hours/${id}`, { method: 'DELETE' }))
