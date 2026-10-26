import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/v2/api'
import type { History, PendingRedemption, Reward } from '@/v2/types'

export interface RewardBody {
  name: string
  price: number
  icon?: string | null
  visible?: boolean
  needs_approval?: boolean
}

export const useRewards = () => useQuery({ queryKey: ['rewards'], queryFn: () => api<Reward[]>('/rewards') })

function useInvalidating<V>(fn: (v: V) => Promise<unknown>, keys: string[]) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSettled: () => Promise.all(keys.map((k) => qc.invalidateQueries({ queryKey: [k] }))),
  })
}

export const useSaveReward = () =>
  useInvalidating(
    ({ id, body }: { id?: number; body: RewardBody }) =>
      id ? api(`/rewards/${id}`, { method: 'PATCH', body }) : api('/rewards', { method: 'POST', body }),
    ['rewards', 'redemptions'],
  )

export const useDeleteReward = () =>
  useInvalidating((id: number) => api(`/rewards/${id}`, { method: 'DELETE' }), ['rewards', 'redemptions'])

export const usePendingRedemptions = () =>
  useQuery({ queryKey: ['redemptions'], queryFn: () => api<PendingRedemption[]>('/redemptions') })

const DECIDED = ['redemptions', 'reward-history', 'today', 'family', 'screen-time']

export const useDecideRedemption = () =>
  useInvalidating(
    ({ id, approve, note }: { id: number; approve: boolean; note?: string }) =>
      api(`/redemptions/${id}/${approve ? 'approve' : 'deny'}`, { method: 'POST', ...(note ? { body: { note } } : {}) }),
    DECIDED,
  )

export const useApproveAll = () =>
  useInvalidating(() => api<{ approved: number; skipped: number }>('/redemptions/approve-all', { method: 'POST' }), DECIDED)

export interface HistoryQuery {
  days: number
  kid_id?: number
  kind?: 'reward' | 'screen_time'
}

export const useRewardHistory = (q: HistoryQuery) =>
  useQuery({
    queryKey: ['reward-history', q.days, q.kid_id ?? null, q.kind ?? null],
    queryFn: () => {
      const p = new URLSearchParams({ days: String(q.days) })
      if (q.kid_id != null) p.set('kid_id', String(q.kid_id))
      if (q.kind) p.set('kind', q.kind)
      return api<History>(`/redemptions/history?${p}`)
    },
  })
