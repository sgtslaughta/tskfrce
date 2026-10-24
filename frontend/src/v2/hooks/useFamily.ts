import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/v2/api'
import type { Family } from '@/v2/types'

export const useFamily = () => useQuery({ queryKey: ['family'], queryFn: () => api<Family>('/family') })

export function usePatchFamily() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (patch: Partial<Family> & { giphy_api_key?: string }) => api<Family>('/family', { method: 'PATCH', body: patch }),
    onSuccess: (fam) => {
      qc.setQueryData(['family'], fam)
      return qc.invalidateQueries({ queryKey: ['today'] })
    },
  })
}

/** POST /users/invite -> one-time sign-up token (24 h). */
export const useInvite = () =>
  useMutation({
    mutationFn: (username: string) =>
      api<{ token: string; expires_in: number }>('/users/invite', { method: 'POST', body: { username } }),
  })

export interface ParentRow {
  id: number
  username: string
  full_name: string | null
  is_me: boolean
}

export const useParents = () => useQuery({ queryKey: ['parents'], queryFn: () => api<ParentRow[]>('/parents') })

/** POST /parents/{id}/reset-link -> one-time password reset link (30 min). */
export const useResetLink = () =>
  useMutation({
    mutationFn: (id: number) => api<{ url: string }>(`/parents/${id}/reset-link`, { method: 'POST' }),
  })
