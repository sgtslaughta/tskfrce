import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, AuthError } from '../api'
import { blocked, kidInit, useAsKid } from './usePreview'
import { toastFail, toastOk } from '../notify'
import type { KidCelebration, KidRewards } from '../types'

/** Expired kid token (401) calls onExpired, like useKidToday. */
function useExpiry(error: unknown, onExpired: () => void) {
  const expired = error instanceof AuthError
  useEffect(() => {
    if (expired) onExpired()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expired])
}

export function useKidRewards(onExpired: () => void) {
  const as = useAsKid()
  const q = useQuery({
    queryKey: ['kid', 'rewards', as],
    queryFn: () => api<KidRewards>('/kid/rewards', kidInit(as)),
  })
  useExpiry(q.error, onExpired)
  return q
}

export type RedeemBody = { kind: 'reward'; reward_id: number } | { kind: 'screen_time'; minutes: number }

export function useRedeem(onExpired: () => void) {
  const qc = useQueryClient()
  const as = useAsKid()
  return useMutation({
    mutationFn: (body: RedeemBody) => as ? blocked() : api('/kid/redeem', { method: 'POST', body, kid: true }),
    onSuccess: (r) => toastOk((r as { status?: string } | undefined)?.status === 'approved' ? "It's yours!" : 'Asked! A parent will see it.'),
    onError: (e: Error) => {
      if (e instanceof AuthError) onExpired()
      else toastFail(e)
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['kid', 'rewards'] }),
  })
}

export function useCelebrations(onExpired: () => void) {
  const as = useAsKid()
  const q = useQuery({
    queryKey: ['kid', 'celebrations', as],
    queryFn: () => api<KidCelebration[]>('/kid/celebrations', kidInit(as)),
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
  })
  useExpiry(q.error, onExpired)
  return q
}

export function useMarkCelebrationSeen(onExpired: () => void) {
  const qc = useQueryClient()
  const as = useAsKid()
  return useMutation({
    mutationFn: (key: string) =>
      as ? blocked() : api(`/kid/celebrations/${encodeURIComponent(key)}/seen`, { method: 'POST', kid: true }),
    onError: (e: Error) => {
      if (e instanceof AuthError) onExpired()
      else if (as) toastFail(e)
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['kid', 'celebrations'] })
      qc.invalidateQueries({ queryKey: ['kid', 'rewards'] })
      qc.invalidateQueries({ queryKey: ['kid', 'today'] })
    },
  })
}
