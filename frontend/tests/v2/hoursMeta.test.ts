import { describe, expect, test } from '@jest/globals'
import { CATEGORIES, KINDS, daysLabel, presetDays, rangeLabel, ruleTexture, segments, sortRules, whoLabel } from '@/v2/manage/hoursMeta'
import type { HourRule } from '@/v2/types'

const rule = (o: Partial<HourRule>): HourRule => ({
  id: 1, name: 'r', category: 'other', kind: 'allowed', days: '0', start_date: null, end_date: null,
  everyone: true, kid_ids: [], group_ids: [], times: [], ...o,
})

describe('hoursMeta', () => {
  test.each([
    ['06:00', '08:00', '6–8a'],
    ['15:00', '20:00', '3–8p'],
    ['08:00', '22:00', '8a–10p'],
    ['16:00', '19:30', '4–7:30p'],
    ['09:00', '21:00', '9a–9p'],
    ['00:00', '06:00', '12–6a'],
  ])('rangeLabel %s-%s', (s, e, out) => expect(rangeLabel(s, e)).toBe(out))

  test('sortRules: everyone by category, then group, then kid', () => {
    const rs = [
      rule({ id: 1, everyone: false, kid_ids: [2] }),
      rule({ id: 2, everyone: false, group_ids: [1] }),
      rule({ id: 3, category: 'summer' }),
      rule({ id: 4, category: 'holiday' }),
      rule({ id: 5, category: 'weekend' }),
      rule({ id: 6, category: 'school_night' }),
    ]
    expect(sortRules(rs).map((r) => r.id)).toEqual([6, 5, 4, 3, 2, 1])
  })

  test('ruleTexture', () => {
    expect(ruleTexture(rule({ everyone: false, kid_ids: [2], group_ids: [1] }))).toBe('pt-kid')
    expect(ruleTexture(rule({ everyone: false, group_ids: [1] }))).toBe('pt-group')
    expect(ruleTexture(rule({ category: 'holiday' }))).toBe('pt-holi')
  })

  test('presetDays', () => {
    expect(presetDays('school_night')).toBe('01236')
    expect(presetDays('weekend')).toBe('45')
    expect(presetDays('summer')).toBe('0123456')
    expect(presetDays('other')).toBeNull()
  })

  test('whoLabel', () => {
    const kids = [{ id: 2, full_name: 'Mia' }] as never
    const groups = [{ id: 1, name: 'Consoles' }] as never
    expect(whoLabel(rule({}), kids, groups)).toBe('Everyone')
    expect(whoLabel(rule({ everyone: false, kid_ids: [2], group_ids: [1] }), kids, groups)).toBe('Mia, Consoles')
    expect(whoLabel(rule({ everyone: false }), kids, groups)).toBe('No one yet')
  })

  test('meta tables and helpers', () => {
    expect(CATEGORIES.map((c) => c.key)).toEqual(['school_night', 'weekend', 'holiday', 'summer', 'other'])
    expect(KINDS.find((k) => k.key === 'off')?.label).toBe('Internet off')
    expect(daysLabel('01234')).toBe('Weekdays')
    expect(segments('22:00', '02:00')).toHaveLength(2)
  })
})
