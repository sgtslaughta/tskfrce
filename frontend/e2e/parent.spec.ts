import { expect, test } from '@playwright/test'
import { loginUi, makeKid, parentApi } from './seed'

test.describe('parent journeys', () => {
  test.beforeEach(async ({ page }) => loginUi(page))

  test('send back needs a note, approve clears the item', async ({ page }) => {
    await page.goto('/')
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
    const card = needs
      .locator('div')
      .filter({ hasText: 'E2E dishes' })
      .filter({ has: page.getByRole('button', { name: 'Approve', exact: true }) })
      .last()
    await card.getByRole('button', { name: 'Approve', exact: true }).click()
    await expect(needs.getByText('E2E dishes')).toHaveCount(0)
  })

  test('create a race chore with subtasks, copy it, edit it', async ({ page }) => {
    const api = await parentApi()
    const a = await makeKid(api, 'Race A')
    const b = await makeKid(api, 'Race B')
    try {
      await page.goto('/kids?section=chores')
      await page.getByRole('button', { name: 'New chore' }).click()
      const drawer = page.getByRole('dialog')
      await drawer.getByLabel('Chore', { exact: true }).fill('E2E race')
      await drawer.getByText('Race A', { exact: true }).click()
      await drawer.getByText('Race B', { exact: true }).click()
      await drawer.getByText('Race', { exact: true }).click()
      for (const s of ['First step', 'Second step']) {
        await drawer.getByLabel('Add a subtask').fill(s)
        await drawer.getByRole('button', { name: 'Add subtask' }).click()
      }
      await drawer.getByRole('button', { name: 'Save', exact: true }).click()
      const row = page.getByRole('button', { name: /E2E race/ })
      await expect(row).toBeVisible()
      await expect(row).toContainText('2 subtasks')
      await expect(row).toContainText('race')

      await row.click()
      await page.getByRole('button', { name: 'Copy' }).click()
      await expect(page.getByLabel('Chore', { exact: true })).toHaveValue('E2E race (copy)')
      await page.getByRole('button', { name: 'Save', exact: true }).click()
      const copy = page.getByRole('button', { name: /E2E race \(copy\)/ })
      await expect(copy).toBeVisible()

      await copy.click()
      await page.getByLabel('Chore', { exact: true }).fill('E2E race edited')
      await page.getByRole('button', { name: 'Save', exact: true }).click()
      await expect(page.getByRole('button', { name: /E2E race edited/ })).toBeVisible()
    } finally {
      await a.undo()
      await b.undo()
      await api.dispose()
    }
  })

  test('change the screen time price', async ({ page }) => {
    const api = await parentApi()
    const before = (await (await api.get('/api/proxy/family')).json()).screen_time_price
    try {
      await page.goto('/settings')
      const price = page.getByLabel(/Screen time price/)
      await price.fill(String(before + 1))
      await page.getByRole('button', { name: 'Save settings' }).click()
      await expect
        .poll(async () => (await (await api.get('/api/proxy/family')).json()).screen_time_price)
        .toBe(before + 1)
    } finally {
      await api.patch('/api/proxy/family', { data: { screen_time_price: before } })
      await api.dispose()
    }
  })
})
