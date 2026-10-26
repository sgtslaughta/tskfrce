/** Parent-screen glyphs for the built-in badges (kid screens keep their emojis). */
export const BADGE_GLYPH: Record<string, string> = {
  first_blood: 'bloodtype',
  task_master: 'assignment_turned_in',
  workhorse: 'fitness_center',
  on_fire: 'whatshot',
  comeback_kid: 'replay',
  weekend_warrior: 'shield',
  variety_pack: 'casino',
  early_bird: 'wb_twilight',
  speedrunner: 'bolt',
  clutch: 'gps_fixed',
  never_late: 'alarm_on',
  stacking: 'landscape',
  saver: 'savings',
  big_spender: 'shopping_bag',
  goal_getter: 'emoji_events',
  patience_pays: 'self_improvement',
  time_lord: 'smartphone',
  drip: 'checkroom',
}

export const badgeGlyph = (b: { key: string; custom: boolean; icon: string }): string =>
  b.custom ? b.icon || 'military_tech' : (BADGE_GLYPH[b.key] ?? 'military_tech')
