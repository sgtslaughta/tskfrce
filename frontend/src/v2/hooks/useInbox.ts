import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../api'
import { toastFail } from '../notify'

export interface InboxItem {
  id: number
  kind: string
  title: string
  body: string | null
  created_at: string
  read: boolean
  run_id: number | null
  redemption_id: number | null
  device_id: number | null
  thread_id: number | null
  points: number | null
  kid_id: number | null
  kid_name: string | null
  /** the chore's picture (Material Symbols name) */
  glyph: string | null
  /** still waiting on a parent (server-computed) */
  pending: boolean
}

export interface Inbox {
  items: InboxItem[]
  unread: number
  has_more: boolean
}

const key = (kid: boolean) => ['inbox', kid ? 'kid' : 'parent']

/** Own notifications, refetched every 30 s, in the background too (OS notifications). */
export const useInbox = (kid = false) =>
  useQuery({
    queryKey: key(kid),
    queryFn: () => api<Inbox>('/notifications', { kid }),
    refetchInterval: 30_000,
    refetchIntervalInBackground: true,
  })

function useInboxMutation<V>(kid: boolean, fn: (v: V) => Promise<unknown>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onError: toastFail,
    onSettled: () => qc.invalidateQueries({ queryKey: key(kid) }),
  })
}

export const useMarkRead = (kid = false) =>
  useInboxMutation(kid, (id: number) => api(`/notifications/${id}/read`, { method: 'POST', kid }))

export const useMarkAllRead = (kid = false) =>
  useInboxMutation(kid, () => api('/notifications/read-all', { method: 'POST', kid }))

export const useDismiss = (kid = false) =>
  useInboxMutation(kid, (id: number) => api(`/notifications/${id}`, { method: 'DELETE', kid }))
