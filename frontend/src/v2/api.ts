import { tokenManager } from '@/services/tokenManager'

export const KID_TOKEN_KEY = 'task4ce-kid-token'

export class ApiError extends Error {
  constructor(
    public status: number,
    public detail: string,
  ) {
    super(detail)
    this.name = 'ApiError'
  }
}

/** Session is gone (401 after refresh, or a bad kid token). `kid` tells callers which login to show. */
export class AuthError extends ApiError {
  constructor(
    detail: string,
    public kid = false,
  ) {
    super(401, detail)
    this.name = 'AuthError'
  }
}

export interface ApiInit {
  method?: string
  body?: unknown
  kid?: boolean
}

const GENERIC = 'Something went wrong. Check your connection and try again.'

function kidToken(): string | null {
  try {
    return localStorage.getItem(KID_TOKEN_KEY)
  } catch {
    return null
  }
}

function detailOf(data: unknown, status: number): string {
  const d = (data as { detail?: unknown } | null)?.detail
  if (typeof d === 'string') return d
  if (Array.isArray(d) && typeof d[0]?.msg === 'string') return d[0].msg
  return status === 401 ? 'Please log in again.' : GENERIC
}

async function send(path: string, init: ApiInit): Promise<Response> {
  const token = init.kid ? kidToken() : tokenManager.getAccessToken()
  const headers: Record<string, string> = {}
  if (token) headers.Authorization = `Bearer ${token}`
  if (init.body !== undefined) headers['Content-Type'] = 'application/json'
  return fetch(`/api/proxy${path}`, {
    method: init.method ?? 'GET',
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  })
}

/** Fetch a v2 backend path (e.g. `/today`) through the Next proxy. */
export async function api<T>(path: string, init: ApiInit = {}): Promise<T> {
  let res = await send(path, init)
  if (res.status === 401 && !init.kid && tokenManager.getRefreshToken()) {
    const r = await tokenManager.refreshTokens()
    if (r.success) res = await send(path, init)
  }
  const text = await res.text()
  let data: unknown = undefined
  try {
    data = text ? JSON.parse(text) : undefined
  } catch {
    data = undefined
  }
  if (res.status === 401) throw new AuthError(detailOf(data, 401), !!init.kid)
  if (!res.ok) throw new ApiError(res.status, detailOf(data, res.status))
  return data as T
}
