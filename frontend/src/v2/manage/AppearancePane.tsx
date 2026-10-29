import { useMantineColorScheme } from '@mantine/core'
import { ACCENTS, type AccentKey } from '@/v2/parent/accent'
import { useResetTips } from '@/v2/hooks/useTips'
import { Icon } from '@/v2/parent/Icon'
import { toastOk } from '@/v2/notify'
import type { Family } from '@/v2/types'
import { PaneCard, PaneHead } from './PaneParts'

interface AppearancePaneProps {
  current: Family
  onChange: (partial: Partial<Family>) => void
}

const MODES = [
  { id: 'light', label: 'Light', icon: 'light_mode' },
  { id: 'dark', label: 'Dark', icon: 'dark_mode' },
  { id: 'auto', label: 'Match device', icon: 'brightness_auto' },
] as const

export function AppearancePane({ current, onChange }: AppearancePaneProps) {
  const { setColorScheme, colorScheme } = useMantineColorScheme()
  const resetTips = useResetTips()

  return (
    <div className="pn">
      <PaneHead title="Appearance" sub="Parent screens only. Kid screens keep their fridge look." />
      <PaneCard icon="palette" title="Accent colour">
        <p className="pn-help">Neon by default. All 10 keep dark text readable at 7:1+ contrast.</p>
        <div className="pn-swatches">
          {(Object.entries(ACCENTS) as [AccentKey, (typeof ACCENTS)[AccentKey]][]).map(([key, accent]) => (
            <button
              key={key}
              type="button"
              className="pn-swatch"
              style={{ background: accent.hex }}
              onClick={() => {
                document.documentElement.style.setProperty('--p-acc', accent.hex)
                onChange({ accent: key })
              }}
              aria-label={accent.name}
              aria-pressed={current.accent === key}
              title={accent.name}
            >
              <span>{accent.name}</span>
            </button>
          ))}
        </div>
      </PaneCard>

      <PaneCard icon="contrast" title="Mode">
        <div className="pn-modes">
          {MODES.map((m) => (
            <button key={m.id} type="button" aria-pressed={colorScheme === m.id} onClick={() => setColorScheme(m.id)}>
              <Icon name={m.icon} size={18} />
              {m.label}
            </button>
          ))}
        </div>
      </PaneCard>

      <PaneCard icon="visibility" title="Preview">
        <div className="pn-prev">
          {['light', 'dark'].map((m) => (
            <div key={m} className={`pn-mini ${m}`}>
              <b>Today</b>
              <div className="pn-bar" />
              <span className="pn-minichip">Approved</span>
            </div>
          ))}
        </div>
      </PaneCard>

      <PaneCard icon="help" title="Tips">
        <p className="pn-help">Show helpful tips again on parent screens.</p>
        <div>
          <button
            type="button"
            className="p-btn"
            disabled={resetTips.isPending}
            aria-busy={resetTips.isPending}
            onClick={() => resetTips.mutate(undefined, { onSuccess: () => toastOk('Tips reset') })}
          >
            <Icon name="help" size={17} />
            Show tips again
          </button>
        </div>
      </PaneCard>
    </div>
  )
}
