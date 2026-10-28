import { claimChat, openChat } from '@/v2/chat/dock'

describe('pending chat request', () => {
  afterEach(() => jest.restoreAllMocks())

  test('claim after openChat gets the request (with its reply) once', () => {
    openChat('chore', '7', { label: 'Step 1' })
    const fn = jest.fn()
    claimChat('chore', '7', fn)()
    expect(fn).toHaveBeenCalledWith({ label: 'Step 1' })
    const again = jest.fn()
    claimChat('chore', '7', again)()
    expect(again).not.toHaveBeenCalled()
  })

  test('a claim for another thread is not triggered', () => {
    openChat('chore', '8')
    const fn = jest.fn()
    claimChat('chore', '9', fn)()
    expect(fn).not.toHaveBeenCalled()
    claimChat('chore', '8', jest.fn())()
  })

  test('expires after 15 s', () => {
    const now = jest.spyOn(Date, 'now').mockReturnValue(1_000)
    openChat('chore', '10')
    now.mockReturnValue(17_000)
    const fn = jest.fn()
    claimChat('chore', '10', fn)()
    expect(fn).not.toHaveBeenCalled()
  })
})
