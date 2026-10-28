import type { InboxItem } from '../hooks/useInbox'
import { daysAgo } from '../clockText'

/** Security alerts: the bell's Alerts tab. */
export const ALERT_KINDS = ['device_resisting', 'device_bypass', 'box_offline']
const NEEDS_KINDS = ['chore_submitted', 'redemption_request', 'chore_note']

/** Still waiting on a parent; the server decides (`pending`), so a stale item gets no buttons. */
export const isNeedsYou = (n: InboxItem): boolean => n.pending && NEEDS_KINDS.includes(n.kind)

export const isAlert = (n: InboxItem): boolean => ALERT_KINDS.includes(n.kind)

export type Tone = 'hi' | 'md' | 'lv' | 'ok'

/** Icon tile for an item: red for security, amber for "look at this", lavender for requests. */
export const severity = (n: InboxItem): { name: string; tone: Tone } => {
  switch (n.kind) {
    case 'device_resisting':
    case 'device_bypass':
      return { name: 'gpp_maybe', tone: 'hi' }
    case 'box_offline':
      return { name: 'router', tone: 'hi' }
    case 'new_device':
      return { name: 'device_unknown', tone: 'md' }
    case 'chore_note':
      return { name: n.glyph ?? 'flag', tone: 'md' }
    case 'chore_submitted':
      return { name: n.glyph ?? 'task_alt', tone: 'lv' }
    case 'redemption_request':
      return { name: 'redeem', tone: 'lv' }
    case 'level_up':
      return { name: 'military_tech', tone: 'ok' }
    case 'badge_earned':
      return { name: 'workspace_premium', tone: 'ok' }
    default:
      return { name: 'notifications', tone: 'ok' }
  }
}

export const isToday = (iso: string, now = new Date()): boolean => daysAgo(iso, now) === 0

/** "9:14 PM" today, "Yesterday", else "Mon 20". */
export const when = (iso: string, now = new Date()): string => {
  const then = new Date(iso)
  const diff = daysAgo(then, now)
  if (diff === 0) return then.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  if (diff === 1) return 'Yesterday'
  return then.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })
}
