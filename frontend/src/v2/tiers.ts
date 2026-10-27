export const TIER_NAMES = ['copper', 'silver', 'gold', 'platinum', 'mega-diamond'] as const

const MEGA = ['#7cc8ff', '#c9b6ff', '#ff9ecd']

/** The one badge-tier palette (mockup 02): parent pips and kid rings both read it. `edge` outlines the fill. */
export const TIER_STYLE: Record<string, { fill: string; edge: string }> = {
  copper: { fill: '#b87333', edge: '#b87333' },
  silver: { fill: '#c0c0c0', edge: '#c0c0c0' },
  gold: { fill: '#ffd23f', edge: '#ffd23f' },
  platinum: { fill: '#e5e4e2', edge: '#9a9a96' },
  'mega-diamond': { fill: `linear-gradient(90deg, ${MEGA.join(', ')})`, edge: 'transparent' },
}
/** Looping gradient stops for the animated mega-diamond ring. */
export const MEGA_STOPS = [...MEGA, MEGA[0]].join(', ')

export const TIER_COLORS: Record<string, string> = Object.fromEntries(Object.entries(TIER_STYLE).map(([k, v]) => [k, v.fill]))
