import { useMediaQuery } from '@mantine/hooks'
import { Icon } from '@/v2/parent/Icon'
import type { AgeGroup } from '../types'

export type KidTab = 'chores' | 'rewards' | 'chat' | 'alerts' | 'me'
export type KidBadges = { chores: number; chat: number; alerts: number }
type Item = [KidTab, string, string]

const ITEMS: Record<AgeGroup, Item[]> = {
  little: [
    ['chores', 'Chores', 'checklist'],
    ['rewards', 'Prizes', 'redeem'],
    ['me', 'Me', 'face'],
  ],
  kid: [
    ['chores', 'Chores', 'checklist'],
    ['rewards', 'Rewards', 'redeem'],
    ['chat', 'Chat', 'chat'],
    ['alerts', 'Alerts', 'notifications'],
    ['me', 'Me', 'face'],
  ],
  teen: [
    ['chores', 'Chores', 'checklist'],
    ['rewards', 'Rewards', 'redeem'],
    ['chat', 'Chat', 'forum'],
    ['alerts', 'Alerts', 'notifications'],
    ['me', 'Me', 'person'],
  ],
}

/** Kid app nav: Little 3-button bottom nav (09); Kid/Teen left rail ≥ 768px (10/11), bottom bar below. */
export function KidNav({
  mode,
  tab,
  onTab,
  badges,
  avatar,
}: {
  mode: AgeGroup
  tab: KidTab
  onTab: (t: KidTab) => void
  badges: KidBadges
  avatar: string | null
}) {
  const wide = useMediaQuery('(min-width: 768px)')
  const kind = mode === 'little' ? 'little' : wide ? 'rail' : 'bar'
  const button = ([t, label, icon]: Item) => {
    const n = t === 'chores' || t === 'chat' || t === 'alerts' ? badges[t] : 0
    const on = tab === t
    return (
      <button
        key={t}
        type="button"
        className="k-nb"
        aria-current={on ? 'page' : undefined}
        aria-label={n > 0 ? `${label} ${n}` : label}
        onClick={() => onTab(t)}
      >
        <Icon name={icon} fill={on} />
        {label}
        {n > 0 && (
          // count drawn by CSS (::after), so the visible text stays inside the name "Chores 3" (WCAG 2.5.3)
          <span className="k-bd" aria-hidden="true" data-n={n > 99 ? '99+' : n} />
        )}
      </button>
    )
  }
  const items = ITEMS[mode]
  return (
    <nav className="k-nav" data-kind={kind} data-mode={mode} aria-label="Kid menu">
      {kind === 'rail' && (
        <span className="k-me" aria-hidden="true">
          {avatar || '🙂'}
        </span>
      )}
      {items.slice(0, -1).map(button)}
      {kind === 'rail' && <span className="k-sp" />}
      {button(items[items.length - 1])}
    </nav>
  )
}
