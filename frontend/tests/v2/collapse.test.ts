import { describe, expect, test } from '@jest/globals'
import { collapseRow } from '@/v2/collapse'

describe('collapseRow', () => {
  test('small rows stay expanded', () => {
    expect(collapseRow(2, 5, 3)).toEqual({ collapsed: false, summary: '✓ 2/5 · +3 devices' })
  })
  test('more than 5 chores collapses', () => {
    expect(collapseRow(4, 6, 0)).toEqual({ collapsed: true, summary: '✓ 4/6 · +0 devices' })
  })
  test('more than 3 devices collapses', () => {
    expect(collapseRow(1, 2, 4).collapsed).toBe(true)
  })
})
