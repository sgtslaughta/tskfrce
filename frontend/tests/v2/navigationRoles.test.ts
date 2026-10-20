import { describe, expect, test } from '@jest/globals'
import { hasRequiredRole } from '@/utils/navigation'

describe('hasRequiredRole with v2 roles', () => {
  test('kid satisfies user only', () => {
    expect(hasRequiredRole('kid', ['user'])).toBe(true)
    expect(hasRequiredRole('kid', ['admin'])).toBe(false)
    expect(hasRequiredRole('kid', ['organizer'])).toBe(false)
  })
  test('parent satisfies admin, organizer and user', () => {
    expect(hasRequiredRole('parent', ['admin'])).toBe(true)
    expect(hasRequiredRole('parent', ['organizer'])).toBe(true)
    expect(hasRequiredRole('parent', ['user'])).toBe(true)
  })
  test('legacy roles still work', () => {
    expect(hasRequiredRole('user', ['user'])).toBe(true)
    expect(hasRequiredRole('organizer', ['admin'])).toBe(false)
  })
})
