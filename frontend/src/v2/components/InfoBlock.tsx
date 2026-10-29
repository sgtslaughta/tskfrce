import styles from './InfoBlock.module.css'

interface InfoBlockProps {
  /** Material Symbols icon name */
  icon: string
  /** Short explanation text */
  text: string
  /** Whether this is a kid-mode info block (uses fridge colors) */
  kidMode?: boolean
  /** Optional additional content */
  children?: React.ReactNode
}

export function InfoBlock({ icon, text, kidMode = false, children }: InfoBlockProps) {
  return (
    <div className={`${styles.block} ${kidMode ? styles.kidMode : styles.parentMode}`} role="region" aria-label="Information">
      <span className={styles.icon} aria-hidden="true">
        <span className="material-symbols-rounded">{icon}</span>
      </span>
      <div className={styles.content}>
        <p className={styles.text}>{text}</p>
        {children && <div className={styles.children}>{children}</div>}
      </div>
    </div>
  )
}
