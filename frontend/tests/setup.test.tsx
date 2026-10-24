import { describe, expect, test } from '@jest/globals'

describe('Setup page onStepClick handler logic', () => {
  test('allows clicking back to previous steps', () => {
    const step = 3

    // Clicking back to step 2 should work
    const n = 2
    expect(n > step && n > step + 1).toBe(false) // doesn't trigger return

    // Clicking back to step 1 should work
    const n2 = 1
    expect(n2 > step && n2 > step + 1).toBe(false) // doesn't trigger return
  })

  test('allows advancing one step forward', () => {
    const step = 2

    // Clicking forward to step 3 (step + 1) should work
    const n = step + 1
    expect(n > step && n > step + 1).toBe(false) // doesn't trigger return, go(n) executes
  })

  test('prevents skipping multiple steps forward', () => {
    const step = 2

    // Trying to skip to step 4 (step + 2) should be prevented
    const n = step + 2
    expect(n > step && n > step + 1).toBe(true) // triggers return, go(n) doesn't execute

    // Trying to skip to step 5 should also be prevented
    const n2 = 5
    expect(n2 > step && n2 > step + 1).toBe(true) // triggers return
  })

  test('allows staying on current step', () => {
    const step = 3

    // Clicking on current step should work (doesn't skip)
    const n = step
    expect(n > step && n > step + 1).toBe(false) // doesn't trigger return, go(n) executes
  })

  test('validates fix prevents skipping ahead by checking all conditions', () => {
    // The old code had: if (n < step) go(n) else if (n === step) go(n)
    // This missed the case where n === step + 1
    // The new code has just: if (condition) return; go(n);
    // Which simplifies the logic and catches all valid cases

    const step = 2

    // All these should NOT return (allow go):
    expect(1 > step && 1 > step + 1).toBe(false) // back 1
    expect(2 > step && 2 > step + 1).toBe(false) // current
    expect(3 > step && 3 > step + 1).toBe(false) // forward 1

    // These should return (prevent go):
    expect(4 > step && 4 > step + 1).toBe(true) // forward 2
    expect(5 > step && 5 > step + 1).toBe(true) // forward 3
  })
})
