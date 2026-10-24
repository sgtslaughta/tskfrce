import { describe, expect, test } from '@jest/globals'
import { ThreadView } from '@/v2/chat/ThreadView'

describe('ThreadView', () => {
  test('quick reply buttons are not in source code (Plan E deferred)', () => {
    // This test verifies that the hard-coded quick reply buttons have been removed
    const source = ThreadView.toString()
    expect(source).not.toContain('Great job!')
    expect(source).not.toContain('Looks good')
    expect(source).not.toContain('Retake the photo')
    expect(source).not.toContain('Edit replies')
  })

  test('@mention button is not in source code (Plan E deferred)', () => {
    // This test verifies that the @mention button has been removed
    const source = ThreadView.toString()
    expect(source).not.toContain('alternate_email')
    expect(source).not.toContain('Mention someone')
  })

  test('component exports ThreadView function', () => {
    expect(ThreadView).toBeDefined()
    expect(typeof ThreadView).toBe('function')
  })
})
