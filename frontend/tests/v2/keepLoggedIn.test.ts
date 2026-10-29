import { beforeEach, expect, test } from '@jest/globals'
import { createSafeStorage, dropIfSessionEnded, setRemember } from '@/services/tokenStorage'

const clearCookie = () => (document.cookie = 'task4ce-alive=; path=/; max-age=0')

beforeEach(() => {
  localStorage.clear()
  clearCookie()
  localStorage.setItem('access_token', 'a')
})

test('unchecked: tokens survive in the same browser session, gone after a restart', () => {
  setRemember(false)
  dropIfSessionEnded(createSafeStorage())
  expect(localStorage.getItem('access_token')).toBe('a')
  clearCookie() // browser closed: session cookie gone
  dropIfSessionEnded(createSafeStorage())
  expect(localStorage.getItem('access_token')).toBeNull()
})

test('checked: tokens survive a restart', () => {
  setRemember(true)
  clearCookie()
  dropIfSessionEnded(createSafeStorage())
  expect(localStorage.getItem('access_token')).toBe('a')
})
