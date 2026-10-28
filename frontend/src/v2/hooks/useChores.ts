import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/v2/api'
import type { Assignment, Chore, LibChore, RunDetail } from '@/v2/types'

export type ChoreMode = Assignment['mode']
export type Repeat = Assignment['repeat']

/** Chore fields only; who/when lives on assignments. */
export interface ChoreBody {
  title: string
  points: number
  needs_photo: boolean
  type_id?: number
  steps: { title: string; due_time?: string | null; after_previous?: boolean }[]
}

export interface AssignmentBody {
  kid_ids: number[]
  mode: ChoreMode
  repeat: Repeat
  on_date: string | null
  due_time: string | null
}

/** GET /chores: the chore library (archived hidden). */
export const useLibrary = () => useQuery({ queryKey: ['chore-lib'], queryFn: () => api<LibChore[]>('/chores/') })

function useChoreMutation<V, R>(fn: (v: V) => Promise<R>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () =>
      Promise.all(['chores-today', 'chore-lib', 'today'].map((k) => qc.invalidateQueries({ queryKey: [k] }))),
  })
}

/** Create (no id) or PATCH (id) a chore's own fields. */
export const useSaveChore = () =>
  useChoreMutation(({ id, body }: { id?: number; body: ChoreBody }) =>
    id
      ? api<LibChore>(`/chores/${id}`, { method: 'PATCH', body })
      : api<LibChore>('/chores/', { method: 'POST', body }),
  )
/** Removes a chore, or archives it when it has history. */
export const useDeleteChore = () => useChoreMutation((id: number) => api(`/chores/${id}`, { method: 'DELETE' }))
export const useCopyChore = () =>
  useChoreMutation((id: number) => api<LibChore>(`/chores/${id}/copy`, { method: 'POST' }))

/** Add (choreId) or edit (id) an assignment. */
export const useSaveAssignment = () =>
  useChoreMutation(({ choreId, id, body }: { choreId: number; id?: number; body: AssignmentBody }) =>
    id
      ? api<Assignment>(`/assignments/${id}`, { method: 'PATCH', body })
      : api<Assignment>(`/chores/${choreId}/assignments`, { method: 'POST', body }),
  )
export const useDeleteAssignment = () =>
  useChoreMutation((id: number) => api(`/assignments/${id}`, { method: 'DELETE' }))

/** GET /chores/{run_id} - parent-only detailed view of a run with steps and photos. */
export const useRunDetail = (runId: number | null) =>
  useQuery({
    queryKey: ['run', runId],
    queryFn: () => api<RunDetail>(`/chores/${runId}`),
    enabled: runId !== null,
  })
