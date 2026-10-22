import { request, type APIRequestContext, type Page } from '@playwright/test'

export const PARENT = { username: 'labparent', password: 'labpassword1' }
const BASE = process.env.E2E_BASE_URL ?? 'http://10.99.0.5:3000'

/** Log in through the form (the same path a parent takes). */
export async function loginUi(page: Page, next = '/') {
  await page.goto(`/login?next=${encodeURIComponent(next)}`)
  await page.getByLabel('Username').fill(PARENT.username)
  await page.getByLabel('Password').fill(PARENT.password)
  await page.getByRole('button', { name: 'Log in' }).click()
  await page.waitForURL((u) => !u.pathname.startsWith('/login'))
}

/** Authenticated API client for seeding, talking to the backend through the app's proxy. */
let token: Promise<string> | undefined // login is rate limited (10/min): log in once per run

export async function parentApi(): Promise<APIRequestContext> {
  token ??= (async () => {
    const anon = await request.newContext({ baseURL: BASE })
    const res = await anon.post('/api/proxy/auth/login', { data: PARENT })
    const { access_token } = await res.json()
    await anon.dispose()
    return access_token as string
  })()
  const access_token = await token
  return request.newContext({
    baseURL: BASE,
    extraHTTPHeaders: { Authorization: `Bearer ${access_token}` },
  })
}

/** A kid with no device, deleted by the returned `undo` (chores go with them). */
export async function makeKid(api: APIRequestContext, name: string) {
  const res = await api.post('/api/proxy/kids', { data: { full_name: name } })
  const kid = await res.json()
  return { kid, undo: () => api.delete(`/api/proxy/kids/${kid.id}`) }
}
