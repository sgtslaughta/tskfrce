import { TIER_COLORS, TIER_NAMES, TIER_STYLE } from '@/v2/tiers'

test('one palette: mockup 02 values for every tier', () => {
  expect(TIER_NAMES.map((n) => TIER_STYLE[n].fill.slice(0, 7))).toEqual(['#b87333', '#c0c0c0', '#ffd23f', '#e5e4e2', 'linear-'])
  expect(TIER_COLORS.gold).toBe('#ffd23f')
  expect(TIER_STYLE.platinum.edge).toBe('#9a9a96')
})
