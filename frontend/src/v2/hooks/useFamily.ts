import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/v2/api'
import type { Family } from '@/v2/types'

/** Polled so a change made on another tab or by the other parent shows up without a reload. */
export const useFamily = () =>
  useQuery({ queryKey: ['family'], queryFn: () => api<Family>('/family'), refetchInterval: 20_000 })

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
export function useInvite() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (username: string) =>
      api<{ token: string; expires_in: number }>('/users/invite', { method: 'POST', body: { username } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['invites'] }),
  })
}

export interface PendingInvite {
  jti: string
  username: string
  expires_in: number
}

export const useInvites = () => useQuery({ queryKey: ['invites'], queryFn: () => api<PendingInvite[]>('/users/invites') })

export function useCancelInvite() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (jti: string) => api<void>(`/users/invites/${jti}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['invites'] }),
  })
}

export interface ParentRow {
  id: number
  username: string
  full_name: string | null
  is_me: boolean
  is_owner: boolean
}

export const useParents = () => useQuery({ queryKey: ['parents'], queryFn: () => api<ParentRow[]>('/parents') })

/** POST /parents/{id}/reset-link -> one-time password reset link (30 min). */
export const useResetLink = () =>
  useMutation({
    mutationFn: (id: number) => api<{ url: string }>(`/parents/${id}/reset-link`, { method: 'POST' }),
  })
