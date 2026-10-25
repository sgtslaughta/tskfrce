import { useEffect } from 'react'
import type { InboxItem } from './hooks/useInbox'
import { toastOk } from './notify'

/** Where a parent notification leads: the device, the chore on Today, or the Needs you list. */
export const dest = (n: InboxItem): string | null =>
  n.device_id
    ? `/devices?item=${n.device_id}`
    : n.run_id
      ? `/?chore=${n.run_id}`
      : n.kind === 'redemption_request'
        ? '/?tab=needs'
        : null

const can = () => typeof window !== 'undefined' && 'Notification' in window // needs https or localhost

/** Ask for OS notification permission on the first click anywhere (browsers want a user gesture). */
export function askOnFirstClick(): void {
  if (!can() || Notification.permission !== 'default') return
  const ask = () =>
    void Notification.requestPermission()
      .then((p) => {
        if (p !== 'granted') return
        toastOk('Notifications on')
        new Notification('Notifications on', { body: "We'll ping you here when something needs you." })
      })
      .catch(() => {})
  document.addEventListener('pointerdown', ask, { once: true })
}

// module scope: the bell can mount twice (rail + header) and must not pop each one twice
const seen = new Set<number>()
let primed = false

/** Pop an OS notification for each new unread item while the app is in the background.
 *  ponytail: only while a tab is open; closed-tab delivery needs Web Push + a service worker. */
export function useOsNotify(items: InboxItem[] | undefined, open: (n: InboxItem) => void): void {
  useEffect(() => {
    if (!items || !can()) return
    const fresh = items.filter((n) => !n.read && !seen.has(n.id))
    items.forEach((n) => seen.add(n.id))
    if (!primed) return void (primed = true) // what's already there on load isn't news
    if (Notification.permission !== 'granted' || document.hasFocus()) return
    for (const n of fresh) {
      const pop = new Notification(n.title, { body: n.body ?? undefined, tag: `t4-${n.id}` })
      pop.onclick = () => (window.focus(), open(n), pop.close())
    }
  }, [items, open])
}
