import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/v2/api'

export interface TipsResponse {
  dismissed: string[]
}

export const useTips = (kid = false) =>
  useQuery({
    queryKey: ['tips', kid],
    queryFn: () => api<TipsResponse>('/me/tips', { kid }),
  })

export const useDismissTip = (kid = false) => {
  const qc = useQueryClient()
  const key = ['tips', kid]
  return useMutation({
    mutationFn: (tipKey: string) => api<{ dismissed: string }>(`/me/tips/${tipKey}/dismiss`, { method: 'POST', kid }),
    onMutate: async (tipKey: string) => {
      // Cancel outgoing refetches
      await qc.cancelQueries({ queryKey: key })
      // Snapshot old data
      const prev = qc.getQueryData<TipsResponse>(key)
      // Optimistically update cache
      qc.setQueryData<TipsResponse>(key, (old) => ({
        dismissed: old ? [...old.dismissed, tipKey] : [tipKey],
      }))
      return prev
    },
    onError: (err, tipKey, context) => {
      // Revert on error
      if (context) qc.setQueryData(key, context)
    },
  })
}

export const useResetTips = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api<TipsResponse>('/me/tips', { method: 'DELETE' }),
    onMutate: async () => {
      // Cancel outgoing refetches
      await qc.cancelQueries({ queryKey: ['tips', false] })
      // Snapshot old data
      const prev = qc.getQueryData<TipsResponse>(['tips', false])
      // Optimistically clear tips
      qc.setQueryData<TipsResponse>(['tips', false], { dismissed: [] })
      return prev
    },
    onError: (err, _args, context) => {
      // Revert on error
      if (context) qc.setQueryData(['tips', false], context)
    },
  })
}

/** Dismissed tips live on the box per user, so they follow the parent/kid across devices. */
export function useTipState(kid = false) {
  const list = useTips(kid).data?.dismissed
  const dismiss = useDismissTip(kid)
  return {
    /** false until the box answers, so a dismissed card never flashes in */
    ready: Array.isArray(list),
    isDismissed: (key: string) => !Array.isArray(list) || list.includes(key),
    dismiss: (key: string) => dismiss.mutate(key),
  }
}
