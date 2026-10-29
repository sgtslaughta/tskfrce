import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/v2/api'
import type { ChoreType } from '@/v2/types'

export interface ChoreTypeBody {
  name: string
  glyph: string
  notes: string[]
}

export const useChoreTypes = () => useQuery({ queryKey: ['chore-types'], queryFn: () => api<ChoreType[]>('/chore-types') })

function useTypeMutation<V, R>(fn: (v: V) => Promise<R>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () =>
      Promise.all(['chore-types', 'chore-lib', 'today'].map((k) => qc.invalidateQueries({ queryKey: [k] }))),
  })
}

/** Create (no id) or PATCH (id) a chore type. */
export const useSaveChoreType = () =>
  useTypeMutation(({ id, body }: { id?: number; body: ChoreTypeBody }) =>
    id
      ? api<ChoreType>(`/chore-types/${id}`, { method: 'PATCH', body })
      : api<ChoreType>('/chore-types', { method: 'POST', body }),
  )
export const useDeleteChoreType = () => useTypeMutation((id: number) => api(`/chore-types/${id}`, { method: 'DELETE' }))
