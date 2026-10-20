import { useQuery } from '@tanstack/react-query'
import { api } from '../api'
import type { Today } from '../types'

/** GET /today, refreshed every 15 s and on window focus. */
export const useToday = () =>
  useQuery({
    queryKey: ['today'],
    queryFn: () => api<Today>('/today'),
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
  })
