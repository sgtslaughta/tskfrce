import { beforeEach, expect, test } from '@jest/globals'
import { tokenManager } from '@/services/tokenManager'

const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url')
const jwt = `${b64({ alg: 'HS256' })}.${b64({ exp: Math.floor(Date.now() / 1000) + 1800, sub: '1' })}.sig`
const fetchMock = jest.fn()
beforeEach(() => {
  ;(global as any).fetch = fetchMock
  fetchMock.mockReset()
  jest.spyOn(console, 'error').mockImplementation(() => {})
  tokenManager.setTokens({ access_token: jwt, refresh_token: 'r', expires_in: 1800 })
})

test('box unreachable (network error) keeps the session', async () => {
  fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
  const r = await tokenManager.refreshTokens()
  expect(r).toMatchObject({ success: false, shouldLogout: false })
  expect(tokenManager.getRefreshToken()).toBe('r')
})

test('a 502 from the proxy keeps the session', async () => {
  fetchMock.mockResolvedValue({ ok: false, status: 502, statusText: 'Bad Gateway' })
  const r = await tokenManager.refreshTokens()
  expect(r).toMatchObject({ success: false, shouldLogout: false })
  expect(tokenManager.getRefreshToken()).toBe('r')
})

test('a 401 is a real logout', async () => {
  jest.useFakeTimers()
  fetchMock.mockResolvedValue({ ok: false, status: 401, statusText: 'Unauthorized' })
  const p = tokenManager.refreshTokens()
  await jest.runAllTimersAsync() // retry backoff
  expect(await p).toMatchObject({ success: false, shouldLogout: true })
  jest.useRealTimers()
})
