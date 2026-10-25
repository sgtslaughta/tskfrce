import { validRef, type ThreadKind } from '@/v2/hooks/useChat'

export const OPEN_CHAT_EVENT = 'task4ce:open-chat'

/** Open a thread: in the floating dock when it is showing, else on the parent Chat page.
 *  The parent shell drops the dock on phones and on /chat; kid pages always have it. */
export function openChat(kind: ThreadKind, ref: string): void {
  if (typeof window === 'undefined' || !validRef(kind, ref)) return
  const parent = document.documentElement.dataset.look === 'parent'
  const noDock = window.matchMedia?.('(max-width: 767px)').matches || window.location.pathname === '/chat'
  if (parent && noDock) {
    window.location.assign(`/chat?item=${kind}:${encodeURIComponent(ref)}`)
    return
  }
  window.dispatchEvent(new CustomEvent(OPEN_CHAT_EVENT, { detail: { kind, ref } }))
}
