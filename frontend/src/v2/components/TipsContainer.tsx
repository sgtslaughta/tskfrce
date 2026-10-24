import { useTips, useDismissTip } from '@/v2/hooks/useTips'
import { QuickTip } from './QuickTip'
import type { TipDefinition } from '@/v2/tips'
import styles from './TipsContainer.module.css'

interface TipsContainerProps {
  /** List of available tips to display */
  tips: TipDefinition[]
  /** Maximum number of tips to show */
  maxTips?: number
  /** Whether this is kid-mode tips (uses fridge colors) */
  kidMode?: boolean
}

/**
 * Container that fetches dismissed tips and displays available tips.
 * Tips are filtered to remove dismissed ones and limited to maxTips.
 */
export function TipsContainer({ tips, maxTips = 3, kidMode = false }: TipsContainerProps) {
  const { data: tipsData, isLoading } = useTips()
  const dismissedKeys = tipsData?.dismissed ?? []

  // Filter to show only non-dismissed tips, up to maxTips
  const tipsToShow = tips
    .filter((t) => !dismissedKeys.includes(t.key))
    .slice(0, maxTips)

  if (isLoading || tipsToShow.length === 0) {
    return null
  }

  return (
    <div className={`${styles.container} ${kidMode ? styles.kidMode : styles.parentMode}`}>
      {tipsToShow.map((tip) => (
        <QuickTip
          key={tip.key}
          tipKey={tip.key}
          icon={tip.icon}
          text={tip.text}
          kidMode={kidMode}
        />
      ))}
    </div>
  )
}
