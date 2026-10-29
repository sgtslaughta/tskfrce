import type { AgeGroup } from '@/v2/types'

export const AGES: { id: AgeGroup; label: string; blurb: string }[] = [
  { id: 'little', label: 'Little (5–8)', blurb: 'Big buttons, one chore at a time, pictures over words.' },
  { id: 'kid', label: 'Kid (9–12)', blurb: 'Big tiles, status banner, chips.' },
  { id: 'teen', label: 'Teen (13+)', blurb: 'List + detail, stats, filters, smaller type.' },
]
export const AGE_LABEL = Object.fromEntries(AGES.map((a) => [a.id, a.label])) as Record<AgeGroup, string>
