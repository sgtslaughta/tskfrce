import { expect, test, type APIRequestContext, type Page } from '@playwright/test'
import { loginUi, parentApi } from './seed'

const BASE = process.env.E2E_BASE_URL ?? 'http://10.99.0.5:3000'

test.use({ actionTimeout: 15_000 })

// first-visit intro and badge celebrations (a parent approving a chore earns one) cover the page
async function cheer(kp: Page) {
  const gates = [kp.getByRole('button', { name: 'Nice!' }), kp.getByRole('button', { name: 'Skip', exact: true })]
  await kp.waitForTimeout(1500)
  for (let i = 0; i < 8; i++) {
    const open = (await Promise.all(gates.map((g) => g.isVisible()))).indexOf(true)
    if (open < 0) return
    await gates[open].click()
    await kp.waitForTimeout(600)
  }
}

/** "HH:MM" in the family's timezone, `min` minutes from now, cut to the whole minute. */
async function hhmmIn(api: APIRequestContext, min: number) {
  const { timezone } = await (await api.get('/api/proxy/family')).json()
  const f = new Intl.DateTimeFormat('en-GB', { timeZone: timezone || 'UTC', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
  return f.format(new Date(Date.now() + min * 60_000))
}

/**
 * Kid "Ivy" (teen) with a chained 2-step chore due in 20 min and a second chore.
 * The due time is a whole minute, so start early in a minute: "Due in 20 min" holds for ~50 s.
 */
async function seedIvy(api: APIRequestContext, tag: string) {
  const sec = new Date().getSeconds()
  if (sec > 3) await new Promise((r) => setTimeout(r, (60 - sec) * 1000))
  const kid = await (await api.post('/api/proxy/kids', { data: { full_name: 'Ivy', pin: '1234', age_group: 'teen' } })).json()
  const titles = { due: `E2E chain ${tag}`, other: `E2E feed fish ${tag}` }
  const due = await (
    await api.post('/api/proxy/chores/', {
      data: { title: titles.due, points: 10, steps: [{ title: 'Fill the tub' }, { title: 'Wash the dog', after_previous: true }] },
    })
  ).json()
  const other = await (await api.post('/api/proxy/chores/', { data: { title: titles.other, points: 5 } })).json()
  const due_time = await hhmmIn(api, 20)
  await api.post(`/api/proxy/chores/${due.id}/assignments`, { data: { kid_ids: [kid.id], mode: 'each', repeat: { type: 'daily' }, due_time } })
  await api.post(`/api/proxy/chores/${other.id}/assignments`, { data: { kid_ids: [kid.id], mode: 'each', repeat: { type: 'daily' } } })
  const undo = async () => {
    for (const id of [due.id, other.id]) await api.delete(`/api/proxy/chores/${id}`)
    await api.delete(`/api/proxy/kids/${kid.id}`)
  }
  return { kid, titles, undo }
}

// Journey: Teen list sorts the due-soon chore first -> parent switches Ivy to Little -> approval reaches her alerts.
test('kid app: teen list, switch to little, approval alert', async ({ browser }) => {
  const api = await parentApi()
  // the e2e container is a lab device: give it to Ivy so the kid screens render
  const devs: { id: number; name: string }[] = await (await api.get('/api/proxy/devices')).json()
  const mine = devs.filter((d) => d.name.includes('e2e-run'))
  test.skip(!mine.length, 'e2e container device was not discovered by the blocker')

  const tag = Date.now().toString(36).slice(-4)
  const { kid, titles, undo } = await seedIvy(api, tag)
  const own = (ids: number[]) =>
    Promise.all(mine.map((d) => api.patch(`/api/proxy/devices/${d.id}`, { data: { owner_ids: ids } })))
  try {
    await own([kid.id])
    const kctx = await browser.newContext({ baseURL: BASE, viewport: { width: 390, height: 844 } })
    const kp = await kctx.newPage()
    try {
      await kp.goto('/kid')
      await kp.waitForTimeout(2500) // the pin pad takes the keyboard once it has hydrated
      await kp.keyboard.type('1234')
      await cheer(kp)

      // 1. Teen: the due-soon chained chore is first; its steps hold back Mark done
      const first = kp.locator('.t-row').first()
      await expect(first).toContainText(titles.due)
      await expect(first).toContainText('Due in 20 min')
      await first.click()
      await expect(kp.getByRole('button', { name: 'Mark done · finish steps first' })).toBeVisible()

      // 2. parent makes Ivy Little: after a reload the chore is "Do this now"
      expect((await api.patch(`/api/proxy/kids/${kid.id}`, { data: { age_group: 'little' } })).ok()).toBe(true)
      await kp.reload()
      await cheer(kp)
      const now = kp.locator('.l-now')
      await expect(now.getByText('Do this now')).toBeVisible()
      await expect(now.getByRole('heading', { name: titles.due })).toBeVisible()

      // 3. parent approves the other chore: Ivy's inbox gets chore_approved
      const today = await (await api.get('/api/proxy/chores/today')).json()
      const runs: { id: number; title: string }[] = today[String(kid.id)]
      const otherRun = runs.find((r) => r.title === titles.other)!
      expect((await api.post(`/api/proxy/chores/${otherRun.id}/done`)).ok()).toBe(true)
      const token = await kp.evaluate(() => localStorage.getItem('task4ce-kid-token'))
      await expect
        .poll(async () => {
          const r = await kp.request.get('/api/proxy/notifications', { headers: { Authorization: `Bearer ${token}` } })
          const items: { kind: string }[] = (await r.json()).items
          return items.map((i) => i.kind)
        })
        .toContain('chore_approved')
    } finally {
      await kctx.close()
    }
  } finally {
    await own([])
    await undo()
    await api.dispose()
  }
})

// The parent's View as kid uses the same full-width shell (no kid device needed).
test('kid app: parent View as kid is full width', async ({ page }) => {
  const api = await parentApi()
  const tag = Date.now().toString(36).slice(-4)
  const { kid, titles, undo } = await seedIvy(api, tag)
  try {
    await page.setViewportSize({ width: 1280, height: 800 })
    await loginUi(page, `/kid?as=${kid.id}`)
    await expect(page.getByText('Viewing as Ivy · preview')).toBeVisible()
    await expect(page.locator('.t-row').first()).toContainText(titles.due)
    const box = await page.locator('.k-app').boundingBox()
    expect(box?.width ?? 0).toBeGreaterThan(1000)
  } finally {
    await undo()
    await api.dispose()
  }
})
