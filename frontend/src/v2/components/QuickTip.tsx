import { useEffect, useState } from 'react'
import { useDismissTip } from '@/v2/hooks/useTips'
import styles from './QuickTip.module.css'

interface QuickTipProps {
  /** Unique identifier for the tip, max 64 chars */
  tipKey: string
  /** Material Symbols icon name */
  icon: string
  /** Short tip text */
  text: string
  /** Whether this is a kid-mode tip (uses fridge colors) */
  kidMode?: boolean
}

export function QuickTip({ tipKey, icon, text, kidMode = false }: QuickTipProps) {
  const [isVisible, setIsVisible] = useState(true)
  const dismissMutation = useDismissTip()

  useEffect(() => {
    // Trigger fade-out animation
    if (!isVisible) {
      const timer = setTimeout(() => {
        dismissMutation.mutate(tipKey)
      }, 150) // Match animation duration
      return () => clearTimeout(timer)
    }
  }, [isVisible, tipKey, dismissMutation])

  const handleDismiss = () => setIsVisible(false)

  return (
    <div
      className={`${styles.tip} ${!isVisible ? styles.dismissed : ''} ${kidMode ? styles.kidMode : styles.parentMode}`}
      role="status"
      aria-live="polite"
    >
      <span className={styles.icon} aria-hidden="true">
        <span className="material-symbols-rounded">{icon}</span>
      </span>
      <span className={styles.text}>{text}</span>
      <button
        className={styles.dismiss}
        onClick={handleDismiss}
        aria-label="Dismiss tip"
        type="button"
      >
        <span className="material-symbols-rounded">close</span>
      </button>
    </div>
  )
}
