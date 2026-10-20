import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/v2/api'
import { toastFail, toastOk } from '@/v2/manage/notify'
import type { Kid } from '@/v2/types'

export interface KidBody {
  full_name?: string
  avatar?: string
  pin?: string
}

export const useKids = () => useQuery({ queryKey: ['kids'], queryFn: () => api<Kid[]>('/kids') })

function useKidMutation<V>(fn: (v: V) => Promise<unknown>, done?: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onError: done ? toastFail : undefined,
    onSuccess: () => {
      if (done) toastOk(done)
      return Promise.all(['kids', 'devices', 'today'].map((k) => qc.invalidateQueries({ queryKey: [k] })))
    },
  })
}

export const useCreateKid = () => useKidMutation((body: KidBody) => api('/kids', { method: 'POST', body }))
export const usePatchKid = () =>
  useKidMutation(({ id, body }: { id: number; body: KidBody }) => api(`/kids/${id}`, { method: 'PATCH', body }))
export const useDeleteKid = () => useKidMutation((id: number) => api(`/kids/${id}`, { method: 'DELETE' }), 'Deleted')
