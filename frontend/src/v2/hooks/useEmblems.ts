import { useQuery } from '@tanstack/react-query'
import { api } from '../api'

/** Emblem id -> emoji, from the flair catalog. Kid pages pass kid: true. */
export const useEmblems = (kid = false) =>
  useQuery({
    queryKey: ['emblems', kid],
    queryFn: () => api<Record<string, string>>('/flair/emblems', { kid }),
    staleTime: Infinity,
  }).data ?? {}
