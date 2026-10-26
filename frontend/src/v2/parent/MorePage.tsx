import Link from 'next/link'
import { useUnifiedAuth } from '@/contexts/UnifiedAuthContext'
import { HELP_URL } from '@/v2/components/AccountMenu'
import { useFamily } from '@/v2/hooks/useFamily'
import { useBlocker } from '@/v2/hooks/useDevices'
import { Icon } from './Icon'

const SETTINGS_SECTIONS = [
  { href: '/settings?section=family', label: 'Family', sub: 'Name, time zone, points', icon: 'home' },
  { href: '/settings?section=screen', label: 'Screen time', sub: 'Price and early unlock', icon: 'timer' },
  { href: '/settings?section=hours', label: 'Hours', sub: 'When devices can be online', icon: 'schedule' },
  { href: '/settings?section=notifications', label: 'Notifications', sub: 'Pings to your chat apps', icon: 'notifications' },
  { href: '/settings?section=look', label: 'Appearance', sub: 'Accent colour, light or dark', icon: 'palette' },
  { href: '/settings?section=gifs', label: 'GIFs', sub: 'GIF search in chat', icon: 'gif_box' },
  { href: '/settings?section=parents', label: 'Parents', sub: 'Invite a parent, reset links', icon: 'group' },
]

export function MorePage({ onLogout }: { onLogout: () => void }) {
  const { user } = useUnifiedAuth()
  const family = useFamily()
  const blocker = useBlocker()

  return (
    <div className="p-more">
      <div className="p-more-profile p-card">
        <div className="p-more-avatar">
          {user?.username.charAt(0).toUpperCase()}
        </div>
        <div className="p-more-info">
          <strong>{user?.username}</strong>
          <p className="p-cap">
            Parent{family.data?.name ? ` · ${family.data.name}` : ''}
          </p>
        </div>
        {blocker.data?.online === false && (
          <span className="p-chip" data-tone="amb">
            <Icon name="router" size={16} />
            Box offline
          </span>
        )}
        {blocker.data?.online === true && (
          <span className="p-chip" data-tone="acc">
            <Icon name="check_circle" size={16} />
            Box healthy
          </span>
        )}
      </div>
      <div className="p-more-section">
        <h2 className="p-cap">Settings</h2>
        <ul className="p-more-list">
          {SETTINGS_SECTIONS.map((section) => (
            <li key={section.href}>
              <Link href={section.href} className="p-more-link">
                <span className="p-more-ic">
                  <Icon name={section.icon} size={20} />
                </span>
                <span className="p-more-t">
                  {section.label}
                  <small>{section.sub}</small>
                </span>
                <Icon name="chevron_right" size={20} />
              </Link>
            </li>
          ))}
        </ul>
      </div>
      <div className="p-more-section">
        <Link href={HELP_URL} target="_blank" rel="noopener noreferrer" className="p-more-link">
          <Icon name="help" />
          Help & guide
        </Link>
      </div>
      <button type="button" onClick={onLogout} className="p-more-logout p-btn" data-variant="ghost">
        <Icon name="logout" />
        Log out
      </button>
    </div>
  )
}
