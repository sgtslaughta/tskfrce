import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/v2/api'

export type ThreadKind = 'chore' | 'private' | 'family'

export interface ThreadSummary {
  id: number
  kind: ThreadKind
  task_id: number | null
  kid_id: number | null
  /** chore threads: the kids the chore is for */
  kid_ids?: number[]
  title: string
  unread: number
  last_message_at: string | null
  last_author?: string | null
  /** one-line text of the newest message; "Photo" for a photo-only one */
  last_text?: string | null
}

export interface ChatMessage {
  id: number
  author_id: number | null
  author_name: string | null
  kind: 'user' | 'system'
  body: string | null
  photo_url: string | null
  created_at: string
  edited_at?: string | null
  /** chore threads: the step this answers */
  step_id?: number | null
  step_title?: string | null
  /** a kid's ready-made note ("Out of supplies") */
  note_label?: string | null
}

export interface ThreadPage {
  id: number
  kind: ThreadKind
  title: string
  messages: ChatMessage[]
  has_more: boolean
  run_id?: number
  /** chore threads: the kid(s) it is about */
  who?: string | null
}

/** URL ref for a thread: chore task id, kid id, or "family". */
export const refOf = (t: Pick<ThreadSummary, 'kind' | 'task_id' | 'kid_id'>) =>
  t.kind === 'chore' ? String(t.task_id) : t.kind === 'private' ? String(t.kid_id) : 'family'

const poll = (ms: number) => ({ refetchInterval: ms, refetchIntervalInBackground: false })

/** GET /chat/threads: threads with unread counts, refreshed every 15 s while the tab is visible. */
export const useThreads = (kid = false) =>
  useQuery({
    queryKey: ['chat-threads', kid],
    queryFn: () => api<{ total: number; threads: ThreadSummary[]; gifs_enabled?: boolean }>('/chat/threads', { kid }),
    ...poll(15_000),
  })

/** True when `ref` is a valid id for `kind` ("family", or a numeric kid/chore id). */
export const validRef = (kind: ThreadKind, ref: string): boolean =>
  kind === 'family' ? ref === 'family' : (kind === 'private' || kind === 'chore') && /^\d+$/.test(ref)

/** `/chat/threads/{kind}/{ref}`; refs come from URLs, so never build a path from an unchecked one. */
function threadPath(kind: ThreadKind, ref: string): string {
  if (!validRef(kind, ref)) throw new Error("That chat doesn't exist.")
  return `/chat/threads/${kind}/${encodeURIComponent(ref)}`
}

/** Newest page of one thread; 5 s while open (pass a longer `ms` for previews). */
export const useThread = (kind: ThreadKind | null, ref: string | null, kid = false, ms = 5_000) =>
  useQuery({
    queryKey: ['chat-thread', kid, kind, ref],
    queryFn: () => api<ThreadPage>(threadPath(kind!, ref!), { kid }),
    enabled: !!kind && !!ref && validRef(kind, ref),
    ...poll(ms),
  })

/** Older messages: GET /chat/threads/{kind}/{ref}?before=<oldest id>. */
export const fetchEarlier = (kind: ThreadKind, ref: string, before: number, kid = false) =>
  api<ThreadPage>(`${threadPath(kind, ref)}?before=${Number(before)}`, { kid })

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
      return api<{ photo_id: number }>(`/chat/threads/${Number(threadId)}/photos`, { method: 'POST', body, kid })
    },
  })

export const usePost = (kid = false) => {
  const refresh = useRefresh(kid)
  return useMutation({
    mutationFn: ({ threadId, body, photoId, stepId }: { threadId: number; body?: string; photoId?: number; stepId?: number }) =>
      api<ChatMessage>(`/chat/threads/${Number(threadId)}/messages`, {
        method: 'POST',
        body: { body: body || null, photo_id: photoId ?? null, ...(stepId ? { step_id: stepId } : {}) },
        kid,
      }),
    onSuccess: refresh,
  })
}

export const useEditMessage = (kid = false) => {
  const refresh = useRefresh(kid)
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: string }) =>
      api<ChatMessage>(`/chat/messages/${Number(id)}`, { method: 'PATCH', body: { body }, kid }),
    onSuccess: refresh,
  })
}

export const useDeleteMessage = (kid = false) => {
  const refresh = useRefresh(kid)
  return useMutation({
    mutationFn: (id: number) => api(`/chat/messages/${Number(id)}`, { method: 'DELETE', kid }),
    onSuccess: refresh,
  })
}

export const useMarkRead = (kid = false) => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (threadId: number) => api(`/chat/threads/${Number(threadId)}/read`, { method: 'POST', kid }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['chat-threads', kid] }),
  })
}

export interface Gif {
  id: string
  width: number
  height: number
  preview_url: string
}

/** GET /chat/gifs?q=: search results, or trending when `q` is empty. */
export const useGifs = (q: string, kid = false, enabled = true) =>
  useQuery({
    queryKey: ['chat-gifs', kid, q],
    queryFn: () => api<Gif[]>(`/chat/gifs?q=${encodeURIComponent(q)}`, { kid }),
    enabled,
    staleTime: 5 * 60_000,
    retry: false,
  })

/** POST /chat/threads/{id}/gifs: the server downloads the GIF and stores it as a chat photo. */
export const usePickGif = (kid = false) =>
  useMutation({
    mutationFn: ({ threadId, gifId }: { threadId: number; gifId: string }) =>
      api<{ photo_id: number }>(`/chat/threads/${Number(threadId)}/gifs`, {
        method: 'POST',
        body: { gif_id: gifId },
        kid,
      }),
  })
