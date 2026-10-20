import { beforeEach, describe, expect, test } from '@jest/globals'
import type { Mock } from 'jest-mock'
import { tokenManager } from '@/services/tokenManager'
import { api, ApiError, AuthError, KID_TOKEN_KEY } from '@/v2/api'

jest.mock('@/services/tokenManager', () => ({
  tokenManager: { getAccessToken: jest.fn(), getRefreshToken: jest.fn(), refreshTokens: jest.fn() },
}))

const tm = tokenManager as unknown as {
  getAccessToken: Mock<() => string | null>
  getRefreshToken: Mock<() => string | null>
  refreshTokens: Mock<() => Promise<{ success: boolean; shouldLogout: boolean }>>
}

const res = (status: number, body?: unknown) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(body === undefined ? '' : JSON.stringify(body)),
  }) as Response

const fetchMock = jest.fn<typeof fetch>()

beforeEach(() => {
  fetchMock.mockReset()
  global.fetch = fetchMock
  tm.getAccessToken.mockReset().mockReturnValue('parent-tok')
  tm.refreshTokens.mockReset()
  tm.getRefreshToken.mockReset().mockReturnValue('refresh-tok')
  localStorage.clear()
})

const headersOf = (call: number) => fetchMock.mock.calls[call][1]?.headers as Record<string, string>

describe('api', () => {
  test('prefixes /api/proxy and sends the parent bearer token', async () => {
    fetchMock.mockResolvedValue(res(200, { day: '2026-10-20' }))
    await expect(api('/today')).resolves.toEqual({ day: '2026-10-20' })
    expect(fetchMock.mock.calls[0][0]).toBe('/api/proxy/today')
    expect(headersOf(0).Authorization).toBe('Bearer parent-tok')
  })

  test('sends JSON body with method', async () => {
    fetchMock.mockResolvedValue(res(200, { ok: true }))
    await api('/kids', { method: 'POST', body: { full_name: 'Emma' } })
    const init = fetchMock.mock.calls[0][1]!
    expect(init.method).toBe('POST')
    expect(init.body).toBe('{"full_name":"Emma"}')
    expect(headersOf(0)['Content-Type']).toBe('application/json')
  })

  test('uses the kid token when kid:true', async () => {
    localStorage.setItem(KID_TOKEN_KEY, 'kid-tok')
    fetchMock.mockResolvedValue(res(200, {}))
    await api('/kid/today', { kid: true })
    expect(headersOf(0).Authorization).toBe('Bearer kid-tok')
  })

  test('parent 401 refreshes once, then throws AuthError', async () => {
    tm.refreshTokens.mockResolvedValue({ success: true, shouldLogout: false })
    fetchMock.mockResolvedValue(res(401, { detail: 'Not authenticated' }))
    await expect(api('/today')).rejects.toBeInstanceOf(AuthError)
    expect(tm.refreshTokens).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  test('parent 401 retries with the new token after a successful refresh', async () => {
    tm.refreshTokens.mockResolvedValue({ success: true, shouldLogout: false })
    tm.getAccessToken.mockReturnValueOnce('old').mockReturnValue('new')
    fetchMock.mockResolvedValueOnce(res(401)).mockResolvedValueOnce(res(200, { ok: 1 }))
    await expect(api('/today')).resolves.toEqual({ ok: 1 })
    expect(headersOf(1).Authorization).toBe('Bearer new')
  })

  test('parent 401 with no refresh token skips refresh', async () => {
    tm.getRefreshToken.mockReturnValue(null)
    fetchMock.mockResolvedValue(res(401, { detail: 'Not authenticated' }))
    await expect(api('/today')).rejects.toBeInstanceOf(AuthError)
    expect(tm.refreshTokens).not.toHaveBeenCalled()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  test('kid 401 throws AuthError without refreshing', async () => {
    fetchMock.mockResolvedValue(res(401, { detail: 'Wrong PIN. Try again.' }))
    await expect(api('/kid/login', { method: 'POST', kid: true })).rejects.toBeInstanceOf(AuthError)
    expect(tm.refreshTokens).not.toHaveBeenCalled()
  })

  test('surfaces backend detail in ApiError', async () => {
    fetchMock.mockResolvedValue(res(400, { detail: 'Unknown time zone.' }))
    const err = await api('/family', { method: 'PATCH', body: {} }).catch((e) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect(err).toMatchObject({ status: 400, detail: 'Unknown time zone.', message: 'Unknown time zone.' })
  })

  test('uses the first validation message for 422 detail lists', async () => {
    fetchMock.mockResolvedValue(res(422, { detail: [{ msg: 'PIN must be exactly 4 digits.' }] }))
    await expect(api('/kids', { method: 'POST', body: {} })).rejects.toMatchObject({
      status: 422,
      detail: 'PIN must be exactly 4 digits.',
    })
  })

  test('empty 204 response resolves undefined', async () => {
    fetchMock.mockResolvedValue(res(204))
    await expect(api('/chores/1', { method: 'DELETE' })).resolves.toBeUndefined()
  })

  test('strips the pydantic "Value error, " prefix', async () => {
    fetchMock.mockResolvedValue(res(422, { detail: [{ msg: 'Value error, PIN must be 4 digits' }] }))
    await expect(api('/kids')).rejects.toMatchObject({ detail: 'PIN must be 4 digits' })
  })
})
