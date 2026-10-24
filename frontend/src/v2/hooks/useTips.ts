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
    onMutate: async (tipKey: string) => {
      // Cancel outgoing refetches
      await qc.cancelQueries({ queryKey: ['tips'] })
      // Snapshot old data
      const prev = qc.getQueryData<TipsResponse>(['tips'])
      // Optimistically update cache
      qc.setQueryData<TipsResponse>(['tips'], (old) => ({
        dismissed: old ? [...old.dismissed, tipKey] : [tipKey],
      }))
      return prev
    },
    onError: (err, tipKey, context) => {
      // Revert on error
      if (context) qc.setQueryData(['tips'], context)
    },
  })
}

export const useResetTips = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api<TipsResponse>('/me/tips', { method: 'DELETE' }),
    onMutate: async () => {
      // Cancel outgoing refetches
      await qc.cancelQueries({ queryKey: ['tips'] })
      // Snapshot old data
      const prev = qc.getQueryData<TipsResponse>(['tips'])
      // Optimistically clear tips
      qc.setQueryData<TipsResponse>(['tips'], { dismissed: [] })
      return prev
    },
    onError: (err, _args, context) => {
      // Revert on error
      if (context) qc.setQueryData(['tips'], context)
    },
  })
}
