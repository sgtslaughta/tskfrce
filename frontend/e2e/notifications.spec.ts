import { expect, request, test } from '@playwright/test'
import { loginUi, parentApi } from './seed'

const BACKEND = process.env.E2E_BACKEND_URL ?? 'http://127.0.0.1:8886'
const TOKEN = process.env.E2E_INTERNAL_TOKEN ?? 'planftoken'

test.use({ actionTimeout: 15_000 })

// Journey: Apprise place (masked, test toast, chips, quiet hours) and the bell with a kid note.
test('apprise place: add, mask, test, chip, quiet hours, bell, delete', async ({ page }) => {
  const api = await parentApi()
  const tag = Date.now().toString(36).slice(-4)
  const name = `E2E ${tag}`
  try {
    await loginUi(page)
    await page.goto('/settings?section=notifications')
    await page.getByRole('button', { name: 'Add a place' }).first().click()
    await page.getByLabel('Name', { exact: true }).fill(name)
    await page.getByLabel('Apprise address').fill('json://127.0.0.1:9/nowhere')
    await page.getByRole('button', { name: 'Save', exact: true }).click()

    const card = page.getByRole('region', { name, exact: true })
    await expect(card.getByText(/^json:\/\/127\.••••/)).toBeVisible()
    await expect(page.getByText('json://127.0.0.1:9/nowhere')).toHaveCount(0)

    await card.getByRole('button', { name: 'Test', exact: true }).click()
    await expect(page.locator('.mantine-Notification-root').first()).toBeVisible()

    const chip = card.getByRole('button', { name: 'Badge / level up' })
    const was = await chip.getAttribute('aria-pressed')
    await chip.click()
    const now = was === 'true' ? 'false' : 'true'
    await expect(chip).toHaveAttribute('aria-pressed', now)
    await page.reload()
    await expect(page.getByRole('region', { name, exact: true }).getByRole('button', { name: 'Badge / level up' })).toHaveAttribute('aria-pressed', now)

    const quiet = page.getByRole('switch', { name: 'Quiet hours' })
    if (!(await quiet.isChecked())) await quiet.click()
    await expect(page.getByLabel('From')).toHaveValue('21:30')
    await page.reload()
    await expect(page.getByLabel('From')).toHaveValue('21:30') // 9:30 PM

    await page.getByRole('button', { name: /^Notifications/ }).click()
    await page.getByRole('link', { name: 'See all' }).click()
    await expect(page).toHaveURL(/\/notifications/)

    await page.goto('/settings?section=notifications')
    await page.getByRole('button', { name: `Remove ${name}` }).click()
    await page.getByRole('button', { name: 'Remove', exact: true }).click()
    await expect(page.getByRole('region', { name, exact: true })).toHaveCount(0)
  } finally {
    const places: { id: number; name: string }[] = await (await api.get('/api/proxy/notify/places')).json()
    for (const p of places.filter((p) => p.name === name)) await api.delete(`/api/proxy/notify/places/${p.id}`)
    await api.dispose()
  }
})

test('kid note shows in the bell under Needs you and Reply opens the chore chat', async ({ page }) => {
  const api = await parentApi()
  const tag = Date.now().toString(36).slice(-4)
  const kidName = `Note ${tag}`
  const choreName = `E2E note ${tag}`
  const kid = await (await api.post('/api/proxy/kids', { data: { full_name: kidName, pin: '1234' } })).json()
  let choreId: number | undefined
  let deviceId: number | undefined
  const bk = await request.newContext({ baseURL: BACKEND })
  try {
    // smallest seeding route: report a device (what the blocker does) at a unique fake LAN address, give it to the kid,
    // and present that address as X-Real-IP (the backend trusts it from loopback)
    const ip = `10.77.${Date.now() % 250}.${(Date.now() >> 8) % 250 + 1}`
    const real = { 'X-Real-IP': ip }
    const seen = await bk.post('/api/v1/internal/devices/seen', {
      headers: { 'X-Internal-Token': TOKEN },
      data: { mac: `02:e2:00:00:${tag.padEnd(4, '0').replace(/[^0-9a-f]/g, '0').replace(/(..)(..)/, '$1:$2')}`, ip, hostname: `e2e-notes-${tag}` },
    })
    expect(seen.ok()).toBe(true)
    deviceId = (await seen.json()).id
    await api.patch(`/api/proxy/devices/${deviceId}`, { data: { owner_ids: [kid.id] } })

    const chore = await (await api.post('/api/proxy/chores/', { data: { title: choreName, points: 10 } })).json()
    choreId = chore.id
    await api.post(`/api/proxy/chores/${chore.id}/assignments`, {
      data: { kid_ids: [kid.id], mode: 'each', repeat: { type: 'daily' } },
    })
    const today = await (await api.get('/api/proxy/chores/today')).json()
    const run: { id: number; title: string } = today[String(kid.id)].find((r: { title: string }) => r.title === choreName)

    const login = await bk.post('/api/v1/kid/login', { headers: real, data: { kid_id: kid.id, pin: '1234' } })
    expect(login.ok()).toBe(true)
    const auth = { ...real, Authorization: `Bearer ${(await login.json()).access_token}` }
    const kt = await (await bk.get('/api/v1/kid/today', { headers: auth })).json()
    const label: string = kt.chores.find((c: { id: number }) => c.id === run.id).notes[0].label
    expect((await bk.post(`/api/v1/kid/chores/${run.id}/note`, { headers: auth, data: { label } })).ok()).toBe(true)

    await loginUi(page)
    await page.getByRole('button', { name: /^Notifications/ }).click()
    await page.getByRole('button', { name: /^Needs you/ }).click()
    const item = page.locator('.p-bell-item').filter({ hasText: choreName })
    await expect(item).toBeVisible()
    await item.getByRole('button', { name: 'Reply' }).click()
    await expect(page).toHaveURL(new RegExp(`chore=${run.id}`))
    const chat = page.getByRole('dialog', { name: 'Chat' })
    await expect(chat.getByRole('heading', { name: new RegExp(choreName) })).toBeVisible()
    await expect(chat.getByRole('textbox', { name: 'Message' })).toBeVisible()
  } finally {
    if (deviceId) {
      await api.patch(`/api/proxy/devices/${deviceId}`, { data: { owner_ids: [] } })
      await api.delete(`/api/proxy/devices/${deviceId}`)
    }
    if (choreId) await api.delete(`/api/proxy/chores/${choreId}`)
    await api.delete(`/api/proxy/kids/${kid.id}`)
    await bk.dispose()
    await api.dispose()
  }
})
