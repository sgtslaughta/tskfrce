import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/v2/api'

export type ThreadKind = 'chore' | 'private' | 'family'

export interface ThreadSummary {
  id: number
  kind: ThreadKind
  task_id: number | null
  kid_id: number | null
  title: string
  unread: number
  last_message_at: string | null
}

export interface ChatMessage {
  id: number
  author_id: number | null
  author_name: string | null
  kind: 'user' | 'system'
  body: string | null
  photo_url: string | null
  created_at: string
}

export interface ThreadPage {
  id: number
  kind: ThreadKind
  title: string
  messages: ChatMessage[]
  has_more: boolean
}

/** URL ref for a thread: chore task id, kid id, or "family". */
export const refOf = (t: Pick<ThreadSummary, 'kind' | 'task_id' | 'kid_id'>) =>
  t.kind === 'chore' ? String(t.task_id) : t.kind === 'private' ? String(t.kid_id) : 'family'

const poll = (ms: number) => ({ refetchInterval: ms, refetchIntervalInBackground: false })

/** GET /chat/threads: threads with unread counts, refreshed every 15 s while the tab is visible. */
export const useThreads = (kid = false) =>
  useQuery({
    queryKey: ['chat-threads', kid],
    queryFn: () => api<{ total: number; threads: ThreadSummary[] }>('/chat/threads', { kid }),
    ...poll(15_000),
  })

/** Newest page of one thread; 5 s while open (pass a longer `ms` for previews). */
export const useThread = (kind: ThreadKind | null, ref: string | null, kid = false, ms = 5_000) =>
  useQuery({
    queryKey: ['chat-thread', kid, kind, ref],
    queryFn: () => api<ThreadPage>(`/chat/threads/${kind}/${ref}`, { kid }),
    enabled: !!kind && !!ref,
    ...poll(ms),
  })

/** Older messages: GET /chat/threads/{kind}/{ref}?before=<oldest id>. */
export const fetchEarlier = (kind: ThreadKind, ref: string, before: number, kid = false) =>
  api<ThreadPage>(`/chat/threads/${kind}/${ref}?before=${before}`, { kid })

function useRefresh(kid: boolean) {
  const qc = useQueryClient()
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ['chat-thread', kid] }),
      qc.invalidateQueries({ queryKey: ['chat-threads', kid] }),
    ])
}

export const useUploadChatPhoto = (kid = false) =>
  useMutation({
    mutationFn: ({ threadId, file }: { threadId: number; file: File }) => {
      const body = new FormData()
      body.append('file', file)
      return api<{ photo_id: number }>(`/chat/threads/${threadId}/photos`, { method: 'POST', body, kid })
    },
  })

export const usePost = (kid = false) => {
  const refresh = useRefresh(kid)
  return useMutation({
    mutationFn: ({ threadId, body, photoId }: { threadId: number; body?: string; photoId?: number }) =>
      api<ChatMessage>(`/chat/threads/${threadId}/messages`, {
        method: 'POST',
        body: { body: body || null, photo_id: photoId ?? null },
        kid,
      }),
    onSuccess: refresh,
  })
}

export const useMarkRead = (kid = false) => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (threadId: number) => api(`/chat/threads/${threadId}/read`, { method: 'POST', kid }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['chat-threads', kid] }),
  })
}
