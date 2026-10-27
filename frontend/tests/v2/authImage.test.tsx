import { afterEach, beforeEach, expect, test } from '@jest/globals'
import { renderHook, waitFor } from '@testing-library/react'
import { tokenManager } from '@/services/tokenManager'
import { KID_TOKEN_KEY } from '@/v2/api'
import { useAuthImage } from '@/v2/today/PhotoViewer'

const fetchMock = jest.fn()
beforeEach(() => {
  fetchMock.mockReset().mockResolvedValue({ ok: true, blob: async () => new Blob(['x']) })
  global.fetch = fetchMock as unknown as typeof fetch
  URL.createObjectURL = jest.fn(() => 'blob:x')
  URL.revokeObjectURL = jest.fn()
})
afterEach(() => localStorage.clear())

const authOf = () => (fetchMock.mock.calls[0][1] as { headers: Record<string, string> }).headers.Authorization

test('kid session (no parent token) sends the kid token', async () => {
  jest.spyOn(tokenManager, 'getAccessToken').mockReturnValue(null)
  localStorage.setItem(KID_TOKEN_KEY, 'kid-jwt')
  const { result } = renderHook(() => useAuthImage('/chat/photos/8/thumb'))
  await waitFor(() => expect(result.current).toBe('blob:x'))
  expect(authOf()).toBe('Bearer kid-jwt')
})

test('parent token wins (parent and view-as-kid)', async () => {
  jest.spyOn(tokenManager, 'getAccessToken').mockReturnValue('parent-jwt')
  localStorage.setItem(KID_TOKEN_KEY, 'kid-jwt')
  renderHook(() => useAuthImage('/chat/photos/8/thumb'))
  await waitFor(() => expect(fetchMock).toHaveBeenCalled())
  expect(authOf()).toBe('Bearer parent-jwt')
})
