import { validRef, type ThreadKind } from '@/v2/hooks/useChat'

export const OPEN_CHAT_EVENT = 'task4ce:open-chat'

/** Ask the chat dock to open a thread; ignored when `ref` is not valid for `kind`. */
export function openChat(kind: ThreadKind, ref: string): void {
  if (typeof window === 'undefined' || !validRef(kind, ref)) return
  window.dispatchEvent(new CustomEvent(OPEN_CHAT_EVENT, { detail: { kind, ref } }))
}
