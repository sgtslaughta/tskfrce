import { validRef, type ThreadKind } from '@/v2/hooks/useChat'

export const OPEN_CHAT_EVENT = 'task4ce:open-chat'
export const OPEN_CHAT_LIST_EVENT = 'task4ce:open-chat-list'

/** Open the floating dock on its thread list (kid nav "Chat"). */
export function openChatList(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(OPEN_CHAT_LIST_EVENT))
}

/** What a new message answers: a chore step or proof photo. `label` names it in the composer. */
export type ChatReply = { step_id?: number; proof_photo_id?: number; label: string }

// An open chore on Today shows its own chat column; it claims openChat for its thread.
const inline = new Map<string, (reply?: ChatReply) => void>()

/** Route openChat(kind, ref) to `fn` while mounted; returns the release function. */
export function claimChat(kind: ThreadKind, ref: string, fn: (reply?: ChatReply) => void): () => void {
  const key = `${kind}:${ref}`
  inline.set(key, fn)
  return () => {
    if (inline.get(key) === fn) inline.delete(key)
  }
}

/** Open a thread: in a claiming inline chat, else the dock (bottom sheet on parent phones, panel elsewhere),
 *  else on the parent Chat page. The parent shell drops the dock only on the desktop /chat page. */
export function openChat(kind: ThreadKind, ref: string, reply?: ChatReply): void {
  if (typeof window === 'undefined' || !validRef(kind, ref)) return
  const claimed = inline.get(`${kind}:${ref}`)
  if (claimed) return claimed(reply)
  const parent = document.documentElement.dataset.look === 'parent'
  const noDock = window.location.pathname === '/chat' && !window.matchMedia?.('(max-width: 767px)').matches
  if (parent && noDock) {
    // ponytail: the reply target is dropped on the full Chat page (no URL param for it yet)
    window.location.assign(`/chat?item=${kind}:${encodeURIComponent(ref)}`)
    return
  }
  window.dispatchEvent(new CustomEvent(OPEN_CHAT_EVENT, { detail: { kind, ref, reply } }))
}
