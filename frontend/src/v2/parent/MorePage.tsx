import Link from 'next/link'
import { useUnifiedAuth } from '@/contexts/UnifiedAuthContext'
import { HELP_URL } from '@/v2/components/AccountMenu'
import { useFamily, useParents } from '@/v2/hooks/useFamily'
import { useSettingsLines } from '@/v2/manage/useSettingsLines'
import { SETTINGS_SECTIONS } from '@/v2/manage/settingsSections'
import { useBlocker } from '@/v2/hooks/useDevices'
import { Icon } from './Icon'

export function MorePage({ onLogout }: { onLogout: () => void }) {
  const { user } = useUnifiedAuth()
  const family = useFamily()
  const blocker = useBlocker()
  const live = useSettingsLines() as Record<string, string | undefined>
  const owner = useParents().data?.find((p) => p.is_me)?.is_owner

  return (
    <div className="p-more">
      <div className="p-more-profile p-card">
        <div className="p-more-avatar">
          {user?.username.charAt(0).toUpperCase()}
        </div>
        <div className="p-more-info">
          <strong>{user?.username}</strong>
          <p className="p-cap">
            {owner ? 'Owner' : 'Parent'}{family.data?.name ? ` · ${family.data.name}` : ''}
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
            <li key={section.id}>
              <Link href={`/settings?section=${section.id}`} className="p-more-link">
                <span className="p-more-ic">
                  <Icon name={section.icon} size={20} />
                </span>
                <span className="p-more-t">
                  {section.label}
                  <small>{live[section.id] ?? section.description}</small>
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
