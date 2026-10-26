import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/v2/api'
import type { BadgeOverview, CustomBadge, RecentAward } from '@/v2/types'

export type BadgeBody = Omit<CustomBadge, 'id'>

export const useCustomBadges = () => useQuery({ queryKey: ['custom-badges'], queryFn: () => api<CustomBadge[]>('/custom-badges') })

export function useSaveBadge() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id?: number; body: BadgeBody }) =>
      id ? api(`/custom-badges/${id}`, { method: 'PATCH', body }) : api('/custom-badges', { method: 'POST', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['custom-badges'] }),
  })
}

export function useDeleteBadge() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api(`/custom-badges/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['custom-badges'] }),
  })
}

export const useBadgeOverview = () => useQuery({ queryKey: ['badge-overview'], queryFn: () => api<BadgeOverview[]>('/badges/overview') })

export const useRecentAwards = () => useQuery({ queryKey: ['recent-awards'], queryFn: () => api<RecentAward[]>('/badges/recent') })

export function useAwardBadge() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, kid_id, note }: { id: number; kid_id: number; note?: string }) =>
      api<{ tier: number }>(`/custom-badges/${id}/award`, { method: 'POST', body: note ? { kid_id, note } : { kid_id } }),
    onSuccess: () => Promise.all(['badge-overview', 'recent-awards'].map((k) => qc.invalidateQueries({ queryKey: [k] }))),
  })
}
