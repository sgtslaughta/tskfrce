import { useQuery } from '@tanstack/react-query'
import { api } from '../api'
import type { Leaderboard, Profile } from '../types'

/** Family-visible progression. Kid pages pass kid: true to use the kid token. */
export const useLeaderboard = (kid = false) =>
  useQuery({ queryKey: ['leaderboard', kid], queryFn: () => api<Leaderboard>('/leaderboard', { kid }) })

export const useProfiles = (kid = false) =>
  useQuery({ queryKey: ['profiles', kid], queryFn: () => api<Profile[]>('/profiles', { kid }) })

export const useProfile = (id: number | null, kid = false) =>
  useQuery({
    queryKey: ['profile', id, kid],
    queryFn: () => api<Profile>(`/profiles/${id}`, { kid }),
    enabled: id !== null,
  })
