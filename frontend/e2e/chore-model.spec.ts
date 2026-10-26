import { expect, test, type Page } from '@playwright/test'
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

// Journey: custom type -> chained chore -> kid locked step -> note -> skip -> deduction.
test('chore model: type, chained steps, kid note, skip, deduction', async ({ page, browser }) => {
  const api = await parentApi()
  const tag = Date.now().toString(36).slice(-4)
  const kidName = `Model ${tag}`
  const typeName = `Garage ${tag}`
  const choreName = `E2E garage ${tag}`
  const otherName = `E2E sweep up ${tag}`
  const thirdName = `E2E mess ${tag}`

  // the e2e container is a lab device: give it to this kid so the kid screens render
  const devs: { id: number; name: string }[] = await (await api.get('/api/proxy/devices')).json()
  const mine = devs.filter((d) => d.name.includes('e2e-run'))
  test.skip(!mine.length, 'e2e container device was not discovered by the blocker')

  const kid = await (await api.post('/api/proxy/kids', { data: { full_name: kidName, pin: '1234' } })).json()
  const own = (ids: number[]) =>
    Promise.all(mine.map((d) => api.patch(`/api/proxy/devices/${d.id}`, { data: { owner_ids: ids } })))
  let typeId: number | undefined
  const choreIds: number[] = []

  try {
    await loginUi(page)

    // 1. parent: new custom type with a note, then a chore of it with two chained steps
    await page.goto('/kids?section=chores')
    await page.getByRole('button', { name: 'New chore' }).click()
    await expect(page.getByRole('heading', { name: 'New chore' })).toBeVisible()
    await page.getByLabel('Chore name', { exact: true }).fill(choreName)
    await page.getByRole('button', { name: 'New type' }).click()
    await page.getByLabel('Name', { exact: true }).fill(typeName)
    await page.getByLabel('Add a note').fill('Too cold')
    await page.getByLabel('Add a note').press('Enter')
    await page.getByRole('button', { name: 'Create type' }).click()
    await expect(page.getByRole('button', { name: typeName, exact: true })).toHaveAttribute('aria-pressed', 'true')
    for (const s of ['Sort the shelves', 'Sweep the floor']) {
      await page.getByLabel('Add a step').fill(s)
      await page.getByLabel('Add a step').press('Enter')
    }
    await page.getByRole('button', { name: 'Any order' }).click()
    await expect(page.getByRole('button', { name: 'Must be done after the step above' })).toBeVisible()
    await page.getByRole('button', { name: 'Save chore' }).click()

    const who = page.getByRole('region', { name: 'Who and when' })
    await who.getByRole('button', { name: kidName }).click()
    await who.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(page.getByRole('button', { name: new RegExp(`^${choreName}`) }).first()).toContainText('2 steps')

    const types: { id: number; name: string }[] = await (await api.get('/api/proxy/chore-types')).json()
    typeId = types.find((t) => t.name === typeName)?.id
    expect(typeId, 'the new type exists').toBeTruthy()
    // another chore for the same kid, ticked off by a parent so only the garage one is open
    const other = await (await api.post('/api/proxy/chores/', { data: { title: otherName, points: 10 } })).json()
    choreIds.push(other.id)
    await api.post(`/api/proxy/chores/${other.id}/assignments`, {
      data: { kid_ids: [kid.id], mode: 'each', repeat: { type: 'daily' } },
    })
    const today = await (await api.get('/api/proxy/chores/today')).json()
    const runs: { id: number; title: string }[] = today[String(kid.id)]
    const garageRun = runs.find((r) => r.title === choreName)!
    const otherRun = runs.find((r) => r.title === otherName)!
    expect((await api.post(`/api/proxy/chores/${otherRun.id}/done`)).ok()).toBe(true)

    // 2. kid (own browser context, same lab device): step 2 is locked, send the "Too cold" note
    await own([kid.id])
    const kctx = await browser.newContext({ baseURL: BASE, viewport: { width: 390, height: 844 } })
    const kp = await kctx.newPage()
    try {
      await kp.goto('/kid')
      await kp.waitForTimeout(2500) // the pin pad takes the keyboard once it has hydrated
      await kp.keyboard.type('1234')
      await kp.getByRole('button', { name: `Open ${choreName}` }).click()
      const step2 = kp.getByRole('checkbox', { name: 'Sweep the floor' })
      await expect(step2).toBeDisabled()
      await expect(kp.getByText('Unlocks after step 1')).toBeVisible()
      await expect(kp.getByRole('checkbox', { name: 'Sort the shelves' })).toBeEnabled()

      await cheer(kp)
      await kp.getByRole('button', { name: 'Tell Mom/Dad' }).click()
      const sheet = kp.getByRole('dialog')
      await sheet.getByRole('button', { name: 'Too cold' }).click()
      const sent = kp.waitForResponse((r) => r.url().includes('/note'))
      await sheet.getByRole('button', { name: 'Send' }).click()
      const res = await sent
      expect(res.status()).toBe(200)
      await expect(kp.getByText('Note sent: Too cold')).toBeVisible()
      // 3. parent Today: Note chip and Skip today
      await page.goto('/')
      await page.getByRole('button', { name: new RegExp(`^M ${kidName}`) }).click()
      const row = page.getByTestId('chore-row').filter({ hasText: choreName })
      await expect(row.getByText('Note').first()).toBeVisible()
      await row.getByRole('button', { name: 'Skip today (no penalty)' }).click()
      await expect(row.getByText('Skipped').first()).toBeVisible()
      // 4. skipped chores leave the kid's lock count: everything left is done
      await expect
        .poll(async () => {
          const r = await kp.request.get('/api/proxy/kid/today', {
            headers: { Authorization: `Bearer ${await kp.evaluate(() => localStorage.getItem('task4ce-kid-token'))}` },
          })
          const chores: { id: number; state: string }[] = (await r.json()).chores
          return chores.length > 0 && chores.every((c) => c.state === 'done') && !chores.some((c) => c.id === garageRun.id)
        })
        .toBe(true)
      await kp.reload()
      await cheer(kp)
      await expect(kp.getByText('Internet is on')).toBeVisible()

      // 5. a new open chore; the parent deducts 5 (preset) with a reason and the kid sees who took what
      const third = await (await api.post('/api/proxy/chores/', { data: { title: thirdName, points: 10 } })).json()
      choreIds.push(third.id)
      await api.post(`/api/proxy/chores/${third.id}/assignments`, {
        data: { kid_ids: [kid.id], mode: 'each', repeat: { type: 'daily' } },
      })
      await page.goto('/')
      await page.getByRole('button', { name: new RegExp(`^M ${kidName}`) }).click()
      await page.getByTestId('chore-row').filter({ hasText: thirdName }).getByRole('button').first().click()
      await page.getByRole('button', { name: 'Deduct points' }).click()
      await page.getByRole('button', { name: '−5', exact: true }).click()
      await page.getByLabel('Reason').fill('Left a mess')
      await page.getByRole('button', { name: 'Deduct', exact: true }).click()
      await expect(page.getByText(/Deducted 5 from/)).toBeVisible()

      await kp.reload()
      await cheer(kp)
      await kp.getByRole('button', { name: `Open ${thirdName}` }).click()
      await expect(kp.getByText('Lab Parent took 5 points')).toBeVisible()
      await expect(kp.getByText('Left a mess')).toBeVisible()
    } finally {
      await kctx.close()
    }
  } finally {
    await own([])
    for (const id of choreIds) await api.delete(`/api/proxy/chores/${id}`)
    const chores: { id: number; title: string }[] = await (await api.get('/api/proxy/chores/')).json()
    for (const c of chores.filter((c) => c.title === choreName)) await api.delete(`/api/proxy/chores/${c.id}`)
    if (typeId) await api.delete(`/api/proxy/chore-types/${typeId}`)
    await api.delete(`/api/proxy/kids/${kid.id}`)
    await api.dispose()
  }
})
