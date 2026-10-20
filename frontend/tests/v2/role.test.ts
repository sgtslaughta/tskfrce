import { describe, expect, test } from '@jest/globals'
import { toRole } from '@/contexts/UnifiedAuthContext'

describe('toRole', () => {
  test('maps v2 and legacy roles', () => {
    expect(toRole('parent')).toBe('parent')
    expect(toRole('admin')).toBe('parent')
    expect(toRole('organizer')).toBe('parent')
    expect(toRole('kid')).toBe('kid')
    expect(toRole('user')).toBe('kid')
    expect(toRole(undefined, true)).toBe('parent')
    expect(toRole(null, false)).toBe('kid')
  })
})
