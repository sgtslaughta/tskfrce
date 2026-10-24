import Link from 'next/link'
import { useUnifiedAuth } from '@/contexts/UnifiedAuthContext'
import { HELP_URL } from '@/v2/components/AccountMenu'
import { BlockerBanner } from '@/v2/components/BlockerBanner'
import { useFamily } from '@/v2/hooks/useFamily'
import { useBlocker } from '@/v2/hooks/useDevices'
import { Icon } from './Icon'

const SETTINGS_SECTIONS = [
  { href: '/settings?section=family', label: 'Family' },
  { href: '/settings?section=hours', label: 'Hours' },
  { href: '/settings?section=appearance', label: 'Appearance' },
  { href: '/settings?section=gifs', label: 'GIFs' },
  { href: '/settings?section=parents', label: 'Parents' },
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
            Owner {family.data?.name && `· ${family.data.name}`}
          </p>
          {blocker.data?.online === false && (
            <div className="p-chip" data-tone="amb">
              <Icon name="router" size={16} />
              <span>Box offline</span>
            </div>
          )}
          {blocker.data?.online !== false && (
            <div className="p-chip" data-tone="acc">
              <Icon name="check_circle" size={16} />
              <span>Box healthy</span>
            </div>
          )}
        </div>
      </div>
      <BlockerBanner />
      <div className="p-more-section">
        <h2 className="p-cap">Settings</h2>
        <ul className="p-more-list">
          {SETTINGS_SECTIONS.map((section) => (
            <li key={section.href}>
              <Link href={section.href} className="p-more-link">
                {section.label}
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
