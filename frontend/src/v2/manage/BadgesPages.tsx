import { useState } from 'react'

// Badge glyph map: maps built-in badge keys to Material Symbols names
// Emoji → glyph mapping; unknown badges fall back to military_tech
export const BADGE_GLYPH: Record<string, string> = {
  unknown: 'military_tech',
  // Add more mappings as needed
}

function getBadgeGlyph(badgeKey: string): string {
  return BADGE_GLYPH[badgeKey] ?? 'military_tech'
}

type BadgesTab = 'all' | 'custom' | 'recent'

interface Props {
  onAward?: (badgeKey: string) => void
  onCreateCustom?: () => void
}

export function BadgesPages({ onAward, onCreateCustom }: Props) {
  const [tab, setTab] = useState<BadgesTab>('all')

  return (
    <div className="p-badges-pages">
      <div className="s-tabs">
        {(['all', 'custom', 'recent'] as const).map((t) => (
          <button
            key={t}
            className={`s-tab ${tab === t ? 's-tab-active' : ''}`}
            onClick={() => setTab(t)}
          >
            {t === 'all' && 'All badges'}
            {t === 'custom' && 'Custom badges'}
            {t === 'recent' && 'Recent awards'}
          </button>
        ))}
      </div>

      {tab === 'all' && (
        <div className="p-all-badges">
          <p>Built-in badges coming soon</p>
          <div className="p-badges-grid">
            {/* Built-in badges will be rendered here */}
          </div>
        </div>
      )}

      {tab === 'custom' && (
        <div className="p-custom-badges">
          <button onClick={() => onCreateCustom?.()}>Create custom badge</button>
          <p>Custom badges coming soon</p>
        </div>
      )}

      {tab === 'recent' && (
        <div className="p-recent-awards">
          <p>Recent awards coming soon</p>
        </div>
      )}
    </div>
  )
}

export { getBadgeGlyph }
