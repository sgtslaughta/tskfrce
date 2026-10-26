import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/v2/api'
import { toastFail } from '@/v2/notify'
import type { KidPush } from '@/v2/types'

export const useKidPush = (kidId: number) =>
  useQuery({ queryKey: ['kid-push', kidId], queryFn: () => api<KidPush>(`/kids/${kidId}/push`) })

export const useResetKidPush = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (kidId: number) => api<KidPush>(`/kids/${kidId}/push/reset`, { method: 'POST' }),
    onSuccess: (_r, kidId) => qc.invalidateQueries({ queryKey: ['kid-push', kidId] }),
    onError: toastFail,
  })
}
