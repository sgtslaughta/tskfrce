import { Button, useComputedColorScheme, useMantineColorScheme } from '@mantine/core'
import { ACCENTS, type AccentKey } from '@/v2/parent/accent'
import { useResetTips } from '@/v2/hooks/useTips'
import { toastOk } from '@/v2/notify'
import type { Family } from '@/v2/types'

interface AppearancePaneProps {
  current: Family
  onChange: (partial: Partial<Family>) => void
}

export function AppearancePane({ current, onChange }: AppearancePaneProps) {
  const { setColorScheme, colorScheme } = useMantineColorScheme()
  const computed = useComputedColorScheme('light', { getInitialValueInEffect: true })
  const resetTips = useResetTips()

  return (
    <section aria-label="Appearance" className="f-card m-card">
      <h2 className="f-display">Appearance</h2>
      <p className="m-help">Parent screens only. Kid screens keep their fridge look.</p>

      <div className="m-section">
        <h3 className="m-subhead">Accent colour</h3>
        <p className="m-help">Neon by default. All 10 keep dark text readable at 7:1+ contrast.</p>
        <div className="accent-swatches">
          {(Object.entries(ACCENTS) as [AccentKey, (typeof ACCENTS)[AccentKey]][]).map(([key, accent]) => (
            <button
              key={key}
              className={`accent-swatch ${current.accent === key ? 'selected' : ''}`}
              style={{ backgroundColor: accent.hex }}
              onClick={() => {
                onChange({ accent: key })
                document.documentElement.style.setProperty('--p-acc', accent.hex)
              }}
              aria-label={accent.name}
              aria-pressed={current.accent === key}
              title={accent.name}
            >
              <span className="swatch-name">{accent.name}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="m-section">
        <h3 className="m-subhead">Mode</h3>
        <div className="mode-buttons">
          <Button
            variant={colorScheme === 'light' ? 'filled' : 'default'}
            aria-pressed={colorScheme === 'light'}
            onClick={() => setColorScheme('light')}
            className="mode-btn"
          >
            <span className="ms">light_mode</span>
            Light
          </Button>
          <Button
            variant={colorScheme === 'dark' ? 'filled' : 'default'}
            aria-pressed={colorScheme === 'dark'}
            onClick={() => setColorScheme('dark')}
            className="mode-btn"
          >
            <span className="ms">dark_mode</span>
            Dark
          </Button>
          <Button
            variant={colorScheme === 'auto' ? 'filled' : 'default'}
            aria-pressed={colorScheme === 'auto'}
            onClick={() => setColorScheme('auto')}
            className="mode-btn"
          >
            <span className="ms">brightness_auto</span>
            Match device
          </Button>
        </div>
      </div>

      <div className="m-section">
        <h3 className="m-subhead">Preview</h3>
        <div className="preview-cards">
          <div className="preview-card light">
            <div className="preview-header">Today</div>
            <div className="preview-bar"></div>
            <span className="preview-chip">Approved</span>
          </div>
          <div className="preview-card dark">
            <div className="preview-header">Today</div>
            <div className="preview-bar"></div>
            <span className="preview-chip">Approved</span>
          </div>
        </div>
      </div>

      <div className="m-section">
        <h3 className="m-subhead">Tips</h3>
        <p className="m-help">Show helpful tips again on parent screens.</p>
        <Button
          onClick={() => {
            resetTips.mutate(undefined, {
              onSuccess: () => toastOk('Tips reset'),
            })
          }}
          loading={resetTips.isPending}
          disabled={resetTips.isPending}
        >
          <span className="ms">help</span>
          Show tips again
        </Button>
      </div>
    </section>
  )
}
