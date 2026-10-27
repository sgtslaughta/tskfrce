import { expect, request, test } from '@playwright/test'
import { loginUi, makeKid, parentApi } from './seed'

test.describe('parent journeys', () => {
  test.beforeEach(async ({ page }) => loginUi(page))

  test('send back needs a note, approve clears the item', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('tab', { name: /Needs you/ }).click()
    const needs = page.getByRole('region', { name: 'Needs you' })
    await expect(needs).toContainText('E2E sweep')

    // photo viewer: send back stays disabled until a note is typed
    await needs.getByRole('button', { name: /Open photo for E2E sweep/ }).click()
    const viewer = page.getByRole('dialog')
    const sendBack = viewer.getByRole('button', { name: 'Send back' })
    await expect(sendBack).toBeDisabled()
    await viewer.getByLabel('Note for sending back').fill('Under the couch too')
    await expect(sendBack).toBeEnabled()
    await sendBack.click()
    await expect(needs.getByText('E2E sweep')).toHaveCount(0)

    // approving the other one clears it too
    const card = needs.locator('.p-needs-item').filter({ hasText: 'E2E dishes' })
    await card.getByRole('button', { name: 'Approve', exact: true }).click()
    await expect(needs.getByText('E2E dishes')).toHaveCount(0)
  })

  test('create a race chore with steps, duplicate it, edit it', async ({ page }) => {
    const api = await parentApi()
    // unique names: a run killed mid-test leaves its kids behind
    const tag = Date.now().toString(36).slice(-4)
    const a = await makeKid(api, `Race A ${tag}`)
    const b = await makeKid(api, `Race B ${tag}`)
    try {
      await page.goto('/kids?section=chores')
      await page.getByRole('button', { name: 'New chore' }).click()
      // the editor swaps from the open chore to the empty form after the route change
      await expect(page.getByRole('heading', { name: 'New chore' })).toBeVisible()
      await page.getByLabel('Chore name', { exact: true }).fill('E2E race')
      for (const s of ['First step', 'Second step']) {
        await page.getByLabel('Add a step').fill(s)
        await page.getByLabel('Add a step').press('Enter')
      }
      await page.getByRole('button', { name: 'Save chore' }).click()

      // saving a new chore opens it; assign it to both kids as a race
      const who = page.getByRole('region', { name: 'Who and when' })
      await who.getByRole('button', { name: `Race A ${tag}` }).click()
      await who.getByRole('button', { name: `Race B ${tag}` }).click()
      await who.getByText('First one wins', { exact: true }).click()
      await who.getByRole('button', { name: 'Save', exact: true }).click()
      const card = page.getByRole('button', { name: /^E2E race/ }).first()
      await expect(card).toContainText('2 steps')

      await page.getByRole('button', { name: 'Duplicate' }).click()
      const name = page.getByLabel('Chore name', { exact: true })
      await expect(name).toHaveValue('E2E race (copy)') // wait for the editor to switch to the copy
      await name.fill('E2E race edited')
      await page.getByRole('button', { name: 'Save chore' }).click()
      await expect(page.getByRole('button', { name: /E2E race edited/ })).toBeVisible()
    } finally {
      const chores = await (await api.get('/api/proxy/chores/')).json()
      for (const c of chores.filter((c: { title: string }) => c.title.startsWith('E2E race')))
        await api.delete(`/api/proxy/chores/${c.id}`)
      await a.undo()
      await b.undo()
      await api.dispose()
    }
  })

  test('bell shows the kid submission, parent gives bonus points', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: /^Notifications/ }).click()
    await expect(page.getByText(/Pat finished E2E/).first()).toBeVisible()
    await page.keyboard.press('Escape')

    const api = await parentApi()
    const k = await makeKid(api, 'Bonus Kid')
    try {
      await page.goto('/kids?section=kids')
      await page.getByRole('button', { name: /Bonus Kid/ }).click()
      await page.getByRole('button', { name: 'Bonus', exact: true }).click()
      await page.getByLabel(/Points \(1 to 500\)/).fill('5')
      await page.getByLabel('Why?').fill('Great teamwork')
      await page.getByRole('button', { name: 'Send points' }).click()
      await expect(page.getByText(/Sent! Bonus Kid got \+5/)).toBeVisible()
    } finally {
      await k.undo()
      await api.dispose()
    }
  })

  test('change the screen time price', async ({ page }) => {
    const api = await parentApi()
    const before = (await (await api.get('/api/proxy/family')).json()).screen_time_price
    try {
      // screen time lives under Rewards (spec §11 errata 1)
      await page.goto('/kids?section=rewards&item=screen')
      const how = page.getByRole('region', { name: 'How it works' })
      await how.getByLabel('Price (points per 15 min)').fill(String(before + 1))
      await how.getByRole('button', { name: 'Save' }).click()
      await expect
        .poll(async () => (await (await api.get('/api/proxy/family')).json()).screen_time_price)
        .toBe(before + 1)
    } finally {
      await api.patch('/api/proxy/family', { data: { screen_time_price: before } })
      await api.dispose()
    }
  })
})

// no browser login needed: only the proxy is under test
test.describe('proxy', () => {
  test('a photo upload through the Next proxy reaches the backend', async () => {
    const api = await request.newContext({ baseURL: process.env.E2E_BASE_URL ?? 'http://10.99.0.5:3000' })
    try {
      const jpeg = Buffer.from(process.env.E2E_JPEG ?? '', 'base64')
      const res = await api.post(`/api/proxy/kid/chores/${process.env.E2E_KID_RUN}/photos`, {
        headers: { Authorization: `Bearer ${process.env.E2E_KID_TOKEN}` },
        multipart: { file: { name: 'p.jpg', mimeType: 'image/jpeg', buffer: jpeg } },
      })
      expect(res.status()).toBe(200)
      expect((await res.json()).id).toBeGreaterThan(0)
    } finally {
      await api.dispose()
    }
  })
})
