import { beforeEach, expect, test } from '@jest/globals'
import { getCookie, getLoginState, saveLoginState } from '@/utils/cookies'
import { createSafeStorage, storeTokens } from '@/services/tokenStorage'

const JWT = 'h.' + btoa(JSON.stringify({ exp: 9999999999 })) + '.s'
const base = { userId: '1', username: 'mom', email: 'm@x', role: 'parent', lastLogin: 1 }

beforeEach(() => {
  localStorage.clear()
  document.cookie = 'taaskmaaster_user=; path=/; max-age=0'
})

test('saveLoginState never writes the token into the cookie', () => {
  saveLoginState({ ...base, token: JWT })
  expect(getCookie('taaskmaaster_user')).not.toContain(JWT)
  expect(getLoginState()).toEqual(base)
})

test('storeTokens keeps the token in localStorage only', () => {
  storeTokens(createSafeStorage(), { access_token: JWT, refresh_token: 'r' } as any, base)
  expect(localStorage.getItem('access_token')).toBe(JWT)
  expect(document.cookie).not.toContain(JWT.slice(0, 10))
})

test('old cookie carrying a token is rewritten without it on read', () => {
  document.cookie = `taaskmaaster_user=${encodeURIComponent(JSON.stringify({ ...base, token: JWT }))}; path=/`
  expect(getLoginState()).toEqual(base)
  expect(getCookie('taaskmaaster_user')).not.toContain('token')
})

test('garbage cookie is dropped, not thrown', () => {
  document.cookie = 'taaskmaaster_user=%7Bnope; path=/'
  jest.spyOn(console, 'error').mockImplementation(() => {})
  expect(getLoginState()).toBeNull()
  expect(getCookie('taaskmaaster_user')).toBeNull()
})
