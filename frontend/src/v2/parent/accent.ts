/**
 * @fileoverview Parent accent color definitions and utilities
 */

export type AccentKey = 'neon' | 'sun' | 'tangerine' | 'bubblegum' | 'lilac' | 'sky' | 'aqua' | 'mint' | 'peach' | 'ice';

export const ACCENTS: Record<AccentKey, { name: string; hex: string }> = {
  neon: { name: 'Neon', hex: '#c3f832' },
  sun: { name: 'Sun', hex: '#ffd23f' },
  tangerine: { name: 'Tangerine', hex: '#ffa94d' },
  bubblegum: { name: 'Bubblegum', hex: '#ff9ecd' },
  lilac: { name: 'Lilac', hex: '#c9b6ff' },
  sky: { name: 'Sky', hex: '#7cc8ff' },
  aqua: { name: 'Aqua', hex: '#5eead4' },
  mint: { name: 'Mint', hex: '#86efac' },
  peach: { name: 'Peach', hex: '#ffc4a3' },
  ice: { name: 'Ice', hex: '#b8f0ff' },
};

/**
 * Get hex color for an accent key, falls back to neon if unknown
 */
export function accentHex(key?: string | null): string {
  if (!key || !(key in ACCENTS)) return ACCENTS.neon.hex;
  return ACCENTS[key as AccentKey].hex;
}
