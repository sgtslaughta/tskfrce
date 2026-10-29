import { request, type APIRequestContext, type Page } from '@playwright/test'

export const PARENT = {
  username: process.env.E2E_PARENT_USER ?? 'labparent',
  password: process.env.E2E_PARENT_PASSWORD ?? 'labpassword1',
}
const BASE = process.env.E2E_BASE_URL ?? 'http://10.99.0.5:3000'

/** Log in through the form (the same path a parent takes). */
export async function loginUi(page: Page, next = '/') {
  await page.goto(`/login?next=${encodeURIComponent(next)}`)
  // login is rate limited (10/min): when a burst of screens hits it, wait it out and retry
  for (let attempt = 0; attempt < 4; attempt++) {
    await page.getByLabel('Username', { exact: true }).fill(PARENT.username)
    await page.getByLabel('Password', { exact: true }).fill(PARENT.password)
    await page.getByRole('button', { name: 'Log in' }).click()
    try {
      await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 15_000 })
      return
    } catch {
      await page.waitForTimeout(20_000)
    }
  }
  await page.waitForURL((u) => !u.pathname.startsWith('/login'))
}

/** Authenticated API client for seeding, talking to the backend through the app's proxy. */
let token: Promise<string> | undefined // login is rate limited (10/min): log in once per run

export async function parentApi(): Promise<APIRequestContext> {
  token ??= (async () => {
    const anon = await request.newContext({ baseURL: BASE })
    let res = await anon.post('/api/proxy/auth/login', { data: PARENT })
    // the screens just before us log in a lot: wait out the login rate limit
    for (let i = 0; i < 6 && res.status() === 429; i++) {
      await new Promise((r) => setTimeout(r, 15_000))
      res = await anon.post('/api/proxy/auth/login', { data: PARENT })
    }
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
