/**
 * Badge glyph map: maps built-in badge emoji keys to Material Symbols names.
 * Emoji characters are not allowed in parent screens.
 * Unknown badges fall back to 'military_tech'.
 */
export const BADGE_GLYPH: Record<string, string> = {
  // Add emoji → glyph mappings here as needed
  // Example: '🏅': 'military_tech'
  // Fallback handled via getBadgeGlyph()
}

/**
 * Get the Material Symbols name for a badge.
 * Falls back to 'military_tech' for unknown badges.
 */
export function getBadgeGlyph(badgeKey: string | null | undefined): string {
  if (!badgeKey) return 'military_tech'
  return BADGE_GLYPH[badgeKey] ?? 'military_tech'
}
