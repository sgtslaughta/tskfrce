import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/v2/api'

export interface TipsResponse {
  dismissed: string[]
}

export const useTips = () =>
  useQuery({
    queryKey: ['tips'],
    queryFn: () => api<TipsResponse>('/me/tips'),
  })

export const useDismissTip = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (tipKey: string) => api<{ dismissed: string }>(`/me/tips/${tipKey}/dismiss`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tips'] }),
  })
}

export const useResetTips = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api<TipsResponse>('/me/tips', { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tips'] }),
  })
}
