import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/v2/api'
import type { Chore } from '@/v2/types'

export interface Repeat {
  type: 'daily' | 'weekly' | 'once'
  days: number[]
}

export interface ChoreBody {
  title: string
  kid_id: number
  points: number
  repeat: Repeat
  needs_photo: boolean
  due_time?: string
}

/** POST /chores/ answer: definition is null for a one-time chore. */
export interface ChoreCreated {
  definition: Chore | null
  instance: Chore | null
}

/** GET /chores/today: today's chores keyed by kid id. */
export const useChoresToday = () =>
  useQuery({ queryKey: ['chores-today'], queryFn: () => api<Record<string, Chore[]>>('/chores/today') })

/** GET /chores/definitions: a kid's repeating chores. */
export interface ChoreDefinition {
  id: number
  title: string
  points: number
  kid_id: number
  repeat: Repeat
  needs_photo: boolean
}
export const useChoreDefinitions = (kidId: number) =>
  useQuery({
    queryKey: ['chore-defs', kidId],
    queryFn: () => api<ChoreDefinition[]>(`/chores/definitions?kid_id=${kidId}`),
  })

function useChoreMutation<V, R>(fn: (v: V) => Promise<R>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => Promise.all(['chores-today', 'chore-defs', 'today'].map((k) => qc.invalidateQueries({ queryKey: [k] }))),
  })
}

export const useCreateChore = () =>
  useChoreMutation((body: ChoreBody) => api<ChoreCreated>('/chores/', { method: 'POST', body }))
/** Stops a repeating chore, by definition id. */
export const useDeleteChore = () => useChoreMutation((id: number) => api(`/chores/${id}`, { method: 'DELETE' }))
