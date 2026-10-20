import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, ApiError, AuthError, KID_TOKEN_KEY } from '../api'
import { toastFail, toastOk } from '../notify'
import type { KidToday, KidWhoami } from '../types'

const readToken = (): string | null => {
  try {
    return localStorage.getItem(KID_TOKEN_KEY)
  } catch {
    return null
  }
}
const KID_ID_KEY = 'task4ce-kid-id'
const readId = (): number | null => {
  try {
    const v = Number(localStorage.getItem(KID_ID_KEY))
    return v > 0 ? v : null
  } catch {
    return null
  }
}
const writeToken = (t: string | null, kidId?: number) => {
  try {
    if (t) {
      localStorage.setItem(KID_TOKEN_KEY, t)
      if (kidId) localStorage.setItem(KID_ID_KEY, String(kidId))
    } else {
      localStorage.removeItem(KID_TOKEN_KEY)
      localStorage.removeItem(KID_ID_KEY)
    }
  } catch {
    /* storage blocked: the session just won't survive a reload */
  }
}

export const loginMessage = (e: unknown): string =>
  e instanceof ApiError && e.status === 429
    ? 'Too many tries. Wait a minute and try again.'
    : e instanceof Error
      ? e.message
      : 'Something went wrong. Try again.'

/** Kid session: token in localStorage, whoami, login, logout. */
export function useKidSession() {
  const qc = useQueryClient()
  const [authed, setAuthed] = useState(false)
  const [ready, setReady] = useState(false)
  const [kidId, setKidId] = useState<number | null>(null)
  useEffect(() => {
    setAuthed(!!readToken())
    setKidId(readId())
    setReady(true)
  }, [])

  const whoami = useQuery({
    queryKey: ['kid', 'whoami'],
    queryFn: () => api<KidWhoami>('/kid/whoami'),
  })
  const login = useMutation({
    mutationFn: (v: { kid_id: number; pin?: string }) =>
      api<{ access_token: string }>('/kid/login', { method: 'POST', body: v, kid: true }),
    onSuccess: (r, v) => {
      writeToken(r.access_token, v.kid_id)
      setKidId(v.kid_id)
      setAuthed(true)
    },
  })
  /** Clear the token and start again at whoami. */
  const logout = () => {
    writeToken(null)
    setKidId(null)
    setAuthed(false)
    login.reset()
    qc.removeQueries({ queryKey: ['kid', 'today'] })
    qc.invalidateQueries({ queryKey: ['kid', 'whoami'] })
  }
  return { ready, authed, kidId, whoami, login, logout }
}

/** Kid's chores and lock state, refetched every 10 s. A 401 calls onExpired. */
export function useKidToday(onExpired: () => void) {
  const q = useQuery({
    queryKey: ['kid', 'today'],
    queryFn: () => api<KidToday>('/kid/today', { kid: true }),
    refetchInterval: 10_000,
  })
  const expired = q.error instanceof AuthError
  useEffect(() => {
    if (expired) onExpired()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expired])
  return q
}

export function useMarkDone(onExpired: () => void) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api(`/kid/chores/${id}/done`, { method: 'POST', kid: true }),
    onSuccess: () => toastOk('Marked done'),
    onError: (e: Error) => {
      if (e instanceof AuthError) onExpired()
      else toastFail(e)
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['kid', 'today'] }),
  })
}
