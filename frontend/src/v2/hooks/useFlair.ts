import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../api'
import { toastFail, toastOk } from '../notify'
import type { Flair, FlairCatalog, FlairSlot } from '../types'

export function useFlair() {
  return useQuery({ queryKey: ['kid', 'flair'], queryFn: () => api<FlairCatalog>('/kid/flair', { kid: true }) })
}

export function useEquip() {
  const qc = useQueryClient()
  const m = useMutation({
    mutationFn: (body: { slot: FlairSlot; id: string | null }) =>
      api<{ equipped: Flair; new_badges: { name: string }[] }>('/kid/flair', { method: 'PUT', body, kid: true }),
    onSuccess: (r) => r.new_badges.forEach((b) => toastOk(`Badge unlocked: ${b.name}`)),
    onError: (e, body) => toastFail(e, () => m.mutate(body)), // PUT: safe to repeat
    onSettled: () => {
      for (const k of ['flair', 'today']) qc.invalidateQueries({ queryKey: ['kid', k] })
      qc.invalidateQueries({ queryKey: ['profiles'] })
      qc.invalidateQueries({ queryKey: ['leaderboard'] })
    },
  })
  return m
}
