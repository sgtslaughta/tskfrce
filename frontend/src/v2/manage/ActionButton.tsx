import type { ReactNode } from 'react'
import { Icon } from '@/v2/parent/Icon'

interface Props {
  icon: string
  children: ReactNode
  onClick: () => void
  variant?: 'red' | 'accent'
  /** This button's action is running: spinner + aria-busy. */
  busy?: boolean
  /** Another action is running (or the button can't be used right now). */
  disabled?: boolean
  label?: string
}

/** Header action button: icon + text, with a spinner while its mutation runs. */
export function ActionButton({ icon, children, onClick, variant, busy, disabled, label }: Props) {
  return (
    <button type="button" className="p-btn" data-variant={variant} aria-label={label} aria-busy={busy || undefined} aria-disabled={busy || undefined} disabled={disabled && !busy} onClick={busy ? undefined : onClick}>
      <Icon name={busy ? 'progress_activity' : icon} size={16} className={busy ? 'p-spin' : undefined} />
      {children}
    </button>
  )
}
