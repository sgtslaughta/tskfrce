import { claimChat, openChat } from '@/v2/chat/dock'

describe('pending chat request', () => {
  afterEach(() => jest.restoreAllMocks())

  test('claim after openChat gets the request (with its reply) once', () => {
    const now = jest.spyOn(Date, 'now').mockReturnValue(1_000)
    openChat('chore', '7', { label: 'Step 1' })
    const fn = jest.fn()
    const release = claimChat('chore', '7', fn)
    now.mockReturnValue(9_000) // released long after: nothing to hand back
    release()
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

  test('a claim dropped right after taking the request hands it to the next claim', () => {
    const now = jest.spyOn(Date, 'now').mockReturnValue(1_000)
    openChat('chore', '11', { label: 'Reply' })
    claimChat('chore', '11', jest.fn())() // Today mounted the row, then re-rendered it away
    now.mockReturnValue(1_500)
    const next = jest.fn()
    claimChat('chore', '11', next)
    expect(next).toHaveBeenCalledWith({ label: 'Reply' })
  })

  test('a request the user dealt with is not handed back on release', () => {
    jest.spyOn(Date, 'now').mockReturnValue(1_000)
    openChat('chore', '12', { label: 'Reply' })
    const release = claimChat('chore', '12', jest.fn())
    release.forget()
    release()
    const next = jest.fn()
    claimChat('chore', '12', next)()
    expect(next).not.toHaveBeenCalled()
  })
})
