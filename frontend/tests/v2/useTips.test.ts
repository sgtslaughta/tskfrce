import { describe, test, expect, beforeEach } from '@jest/globals'
import { useTipsLocal } from '@/v2/hooks/useTips'
import { renderHook, act } from '@testing-library/react'

describe('useTipsLocal', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  test('isDismissed returns false for unknown keys', () => {
    const { result } = renderHook(() => useTipsLocal())
    expect(result.current.isDismissed('unknown')).toBe(false)
  })

  test('isDismissed returns true after dismiss', () => {
    const { result } = renderHook(() => useTipsLocal())
    act(() => {
      result.current.dismiss('onboard.parent')
    })
    expect(result.current.isDismissed('onboard.parent')).toBe(true)
  })

  test('isDismissed persists across instances', () => {
    const { result: result1 } = renderHook(() => useTipsLocal())
    act(() => {
      result1.current.dismiss('onboard.kid')
    })

    const { result: result2 } = renderHook(() => useTipsLocal())
    expect(result2.current.isDismissed('onboard.kid')).toBe(true)
  })

  test('handles localStorage errors gracefully', () => {
    const { result } = renderHook(() => useTipsLocal())
    // Mock localStorage error
    const originalSetItem = Storage.prototype.setItem
    Storage.prototype.setItem = () => {
      throw new Error('Storage full')
    }

    expect(() => {
      result.current.dismiss('onboard.parent')
    }).not.toThrow()

    Storage.prototype.setItem = originalSetItem
  })
})
