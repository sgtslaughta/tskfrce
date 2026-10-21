import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/v2/api'
import type { CustomBadge } from '@/v2/types'

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

export const useAwardBadge = () =>
  useMutation({
    mutationFn: ({ id, kid_id }: { id: number; kid_id: number }) =>
      api<{ tier: number }>(`/custom-badges/${id}/award`, { method: 'POST', body: { kid_id } }),
  })
