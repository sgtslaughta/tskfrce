import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, AuthError } from '../api'
import { toastFail, toastOk } from '../notify'
import type { KidAward, KidRewards } from '../types'

/** Expired kid token (401) calls onExpired, like useKidToday. */
function useExpiry(error: unknown, onExpired: () => void) {
  const expired = error instanceof AuthError
  useEffect(() => {
    if (expired) onExpired()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expired])
}

export function useKidRewards(onExpired: () => void) {
  const q = useQuery({
    queryKey: ['kid', 'rewards'],
    queryFn: () => api<KidRewards>('/kid/rewards', { kid: true }),
  })
  useExpiry(q.error, onExpired)
  return q
}

export type RedeemBody = { kind: 'reward'; reward_id: number } | { kind: 'screen_time'; minutes: number }

export function useRedeem(onExpired: () => void) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: RedeemBody) => api('/kid/redeem', { method: 'POST', body, kid: true }),
    onSuccess: () => toastOk('Asked! A parent will see it.'),
    onError: (e: Error) => {
      if (e instanceof AuthError) onExpired()
      else toastFail(e)
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['kid', 'rewards'] }),
  })
}

export function useAwards(onExpired: () => void) {
  const q = useQuery({
    queryKey: ['kid', 'awards'],
    queryFn: () => api<KidAward[]>('/kid/awards', { kid: true }),
    refetchInterval: 15_000,
  })
  useExpiry(q.error, onExpired)
  return q
}

export function useMarkAwardSeen(onExpired: () => void) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api(`/kid/awards/${id}/seen`, { method: 'POST', kid: true }),
    onError: (e: Error) => {
      if (e instanceof AuthError) onExpired()
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['kid', 'awards'] })
      qc.invalidateQueries({ queryKey: ['kid', 'rewards'] })
      qc.invalidateQueries({ queryKey: ['kid', 'today'] })
    },
  })
}
