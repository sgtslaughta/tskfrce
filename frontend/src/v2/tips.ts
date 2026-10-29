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
