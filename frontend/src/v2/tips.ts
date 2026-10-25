/**
 * Tips definitions and utilities.
 * Tip keys must match: ^[a-z0-9._-]{1,64}$
 */

export interface TipDefinition {
  key: string
  icon: string
  text: string
}

/** Parent screen tips */
export const PARENT_TIPS: TipDefinition[] = [
  {
    key: 'devices.name',
    icon: 'info',
    text: 'Name devices so you know whose they are.',
  },
  {
    key: 'settings.hours',
    icon: 'info',
    text: 'Set up hour patterns with holidays and summer breaks.',
  },
  {
    key: 'rewards.points',
    icon: 'info',
    text: 'Award points for completed chores, then kids redeem for rewards.',
  },
]

/** Kid screen tips (Little mode) */
export const KID_TIPS_LITTLE: TipDefinition[] = [
  {
    key: 'kid.i_did_it',
    icon: 'info',
    text: 'Tap I did it! when your chore is done.',
  },
  {
    key: 'kid.tell_mom_dad',
    icon: 'info',
    text: 'Need help? Tap Tell Mom or Dad.',
  },
]

/** Kid screen tips (Kid & Teen modes) */
export const KID_TIPS_OLDER: TipDefinition[] = [
  {
    key: 'kid.mark_done',
    icon: 'info',
    text: 'Mark done when all steps are finished.',
  },
  {
    key: 'kid.locked_chores',
    icon: 'info',
    text: 'Locked steps show when the step before is done.',
  },
]

/**
 * Get the list of tips to show for a screen.
 * Filter by: not yet dismissed, and appropriate for the audience.
 */
export function getTipsToShow(
  dismissedKeys: string[],
  tips: TipDefinition[],
): TipDefinition[] {
  const dismissed = new Set(dismissedKeys)
  return tips.filter((t) => !dismissed.has(t.key))
}

/**
 * Validate a tip key format.
 */
export function isValidTipKey(key: string): boolean {
  return /^[a-z0-9._-]{1,64}$/.test(key)
}
