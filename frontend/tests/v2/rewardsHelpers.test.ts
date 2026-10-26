import { describe, expect, test } from '@jest/globals'
import { BADGE_GLYPH, badgeGlyph } from '@/v2/badgeGlyphs'
import { REWARD_GLYPHS } from '@/v2/parent/glyphs'
import { toCsv } from '@/v2/manage/historyCsv'
import type { HistoryRow } from '@/v2/types'

const CATALOG = ['first_blood', 'task_master', 'workhorse', 'on_fire', 'comeback_kid', 'weekend_warrior', 'variety_pack', 'early_bird', 'speedrunner', 'clutch', 'never_late', 'stacking', 'saver', 'big_spender', 'goal_getter', 'patience_pays', 'time_lord', 'drip']
const MIGRATION_TARGETS = ['movie', 'icecream', 'bedtime', 'local_pizza', 'restaurant', 'sports_esports', 'park', 'cake', 'toys', 'timer', 'payments', 'menu_book', 'redeem', 'shopping_bag', 'sports_soccer', 'palette', 'music_note', 'pool', 'pedal_bike', 'cookie', 'celebration', 'star']

const row = (o: Partial<HistoryRow>): HistoryRow => ({
  id: 1, kid_id: 1, kid_name: 'Leo', kind: 'reward', name: 'Movie', minutes: null, cost: 50, status: 'approved',
  auto: false, decided_by_name: 'Mom', note: null, created_at: '2026-10-20T10:00:00Z', decided_at: '2026-10-20T11:00:00Z', ...o,
})

describe('badgeGlyph', () => {
  test('built-in, unknown and custom', () => {
    expect(badgeGlyph({ key: 'on_fire', custom: false, icon: '🔥' })).toBe('whatshot')
    expect(badgeGlyph({ key: 'nope', custom: false, icon: '' })).toBe('military_tech')
    expect(badgeGlyph({ key: 'custom:1', custom: true, icon: 'pets' })).toBe('pets')
    expect(badgeGlyph({ key: 'custom:1', custom: true, icon: '' })).toBe('military_tech')
  })
  test('every catalog key has an entry', () => {
    for (const k of CATALOG) expect(BADGE_GLYPH[k]).toBeTruthy()
  })
})

test('REWARD_GLYPHS covers migration targets', () => {
  for (const g of MIGRATION_TARGETS) expect(REWARD_GLYPHS).toContain(g)
})

describe('toCsv', () => {
  test('header and status mapping', () => {
    const lines = toCsv([row({}), row({ status: 'denied' }), row({ auto: true })]).split('\n')
    expect(lines[0]).toBe('date,kid,item,kind,status,points,decided_by,note')
    expect(lines[1]).toContain(',approved,50,Mom,')
    expect(lines[2]).toContain(',declined,')
    expect(lines[3]).toContain(',auto,')
  })
  test('quotes commas and doubles quotes', () => {
    const csv = toCsv([row({ note: "let's talk, Sat" }), row({ note: 'say "hi"' })])
    expect(csv).toContain('"let\'s talk, Sat"')
    expect(csv).toContain('"say ""hi"""')
  })
})
