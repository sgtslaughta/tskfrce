import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/v2/api'
import type { PendingRedemption, Reward } from '@/v2/types'

export interface RewardBody {
  name: string
  price: number
  icon?: string
}

export const useRewards = () => useQuery({ queryKey: ['rewards'], queryFn: () => api<Reward[]>('/rewards') })

export const usePendingRedemptions = () =>
  useQuery({
    queryKey: ['redemptions'],
    queryFn: () => api<PendingRedemption[]>('/redemptions'),
    refetchInterval: 30_000,
  })

function useInvalidating<V>(fn: (v: V) => Promise<unknown>, keys: string[]) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => Promise.all(keys.map((k) => qc.invalidateQueries({ queryKey: [k] }))),
  })
}

export const useSaveReward = () =>
  useInvalidating(
    ({ id, body }: { id?: number; body: RewardBody }) =>
      id ? api(`/rewards/${id}`, { method: 'PATCH', body }) : api('/rewards', { method: 'POST', body }),
    ['rewards'],
  )

export const useDeleteReward = () =>
  useInvalidating((id: number) => api(`/rewards/${id}`, { method: 'DELETE' }), ['rewards', 'redemptions'])

export const useDecideRedemption = () =>
  useInvalidating(
    ({ id, approve }: { id: number; approve: boolean }) =>
      api(`/redemptions/${id}/${approve ? 'approve' : 'deny'}`, { method: 'POST' }),
    ['redemptions', 'today', 'family'],
  )
