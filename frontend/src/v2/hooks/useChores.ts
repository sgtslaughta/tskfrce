import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/v2/api'
import type { Chore } from '@/v2/types'

export interface Repeat {
  type: 'daily' | 'weekly' | 'once'
  days: number[]
}

export interface ChoreBody {
  title: string
  kid_ids: number[]
  mode: ChoreMode
  points: number
  repeat: Repeat
  needs_photo: boolean
  due_time?: string | null
  subtasks: string[]
}

export type ChoreMode = 'each' | 'race' | 'team'

/** POST /chores/ answer: definition is null for a one-time chore. */
export interface ChoreCreated {
  definition: Chore | null
  instance: Chore | null
}

/** GET /chores/today: today's chores keyed by kid id. */
export const useChoresToday = () =>
  useQuery({ queryKey: ['chores-today'], queryFn: () => api<Record<string, Chore[]>>('/chores/today') })

/** GET /chores/definitions: repeating chores, optionally for one kid. */
export interface ChoreDefinition {
  id: number
  title: string
  points: number
  kid_ids: number[]
  mode: ChoreMode
  repeat: Repeat
  needs_photo: boolean
  due_time: string | null
  subtasks: string[]
}
export const useChoreDefinitions = (kidId?: number) =>
  useQuery({
    queryKey: ['chore-defs', kidId ?? 'all'],
    queryFn: () => api<ChoreDefinition[]>(`/chores/definitions${kidId ? `?kid_id=${kidId}` : ''}`),
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
/** PATCH /chores/{definition_id}: edits the repeating chore and today's untouched copies. */
export const usePatchChore = () =>
  useChoreMutation(({ id, body }: { id: number; body: ChoreBody }) =>
    api<ChoreDefinition>(`/chores/${id}`, { method: 'PATCH', body }),
  )
