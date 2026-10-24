import { describe, test, expect, beforeEach } from '@jest/globals'
import { useTips } from '@/v2/hooks/useTips'
import { renderHook, act } from '@testing-library/react'

describe('useTips', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  test('isDismissed returns false for unknown keys', () => {
    const { result } = renderHook(() => useTips())
    expect(result.current.isDismissed('unknown')).toBe(false)
  })

  test('isDismissed returns true after dismiss', () => {
    const { result } = renderHook(() => useTips())
    act(() => {
      result.current.dismiss('onboard.parent')
    })
    expect(result.current.isDismissed('onboard.parent')).toBe(true)
  })

  test('isDismissed persists across instances', () => {
    const { result: result1 } = renderHook(() => useTips())
    act(() => {
      result1.current.dismiss('onboard.kid')
    })

    const { result: result2 } = renderHook(() => useTips())
    expect(result2.current.isDismissed('onboard.kid')).toBe(true)
  })

  test('handles localStorage errors gracefully', () => {
    const { result } = renderHook(() => useTips())
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
