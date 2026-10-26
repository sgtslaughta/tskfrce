import { expect, test, type APIRequestContext } from '@playwright/test'
import { loginUi, makeKid, parentApi } from './seed'

// Seeding a device needs the blocker's internal endpoint (not behind the app proxy).
const API = process.env.E2E_API_URL ?? 'http://127.0.0.1:8866'
const TOKEN = process.env.E2E_INTERNAL_TOKEN ?? 'plandtoken'

test.use({ actionTimeout: 15_000 })
test.setTimeout(240_000)

const hhmm = (h: number, m = 0) => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`

/** Current hour in the family's time zone. */
async function familyHour(api: APIRequestContext): Promise<number> {
  const fam = await (await api.get('/api/proxy/family')).json()
  const h = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hourCycle: 'h23', timeZone: fam.timezone || 'UTC' }).format(new Date())
  return Number(h)
}

// Journey: one "internet off" rule for a kid and a group locks the kid's device, one edit opens it,
// a manual lock/unlock lands in Lock history, and the group lists the rule.
test('hour rules and device activity: one rule, every target', async ({ page }) => {
  const api = await parentApi()
  const tag = Date.now().toString(36).slice(-4)
  const ruleName = `Homework time ${tag}`
  const { kid, undo: undoKid } = await makeKid(api, `kid1 ${tag}`)
  const n = Date.now()
  const mac = `02:e2:${[n >> 24, n >> 16, n >> 8, n].map((b) => (b & 255).toString(16).padStart(2, '0')).join(':')}`
  let deviceId: number | undefined
  let groupId: number | undefined
  let ruleId: number | undefined
  let baseId: number | undefined

  try {
    // seed: a device (as the blocker would report it) owned by the kid, plus a group holding it
    await api.fetch(`${API}/api/v1/internal/devices/seen`, {
      method: 'POST',
      headers: { 'X-Internal-Token': TOKEN },
      data: { mac: mac, ip: '10.99.0.77', hostname: `e2e-kid1-${tag}` },
    })
    const devs: { id: number; name: string }[] = await (await api.get('/api/proxy/devices')).json()
    deviceId = devs.find((d) => d.name === `e2e-kid1-${tag}`)?.id
    expect(deviceId, 'seeded device').toBeTruthy()
    await api.patch(`/api/proxy/devices/${deviceId}`, { data: { name: `Kid1 tablet ${tag}`, owner_ids: [kid.id] } })
    const grp = await (await api.post('/api/proxy/groups', { data: { name: `Study ${tag}`, device_ids: [deviceId] } })).json()
    groupId = grp.id

    // kid1's own all-day hours: they outrank any family hours already on the box, so "Open" means open
    const base = await (await api.post('/api/proxy/hours', { data: {
      name: `Always on ${tag}`, category: 'other', kind: 'allowed', days: '0123456', everyone: false,
      kid_ids: [kid.id], group_ids: [], times: [{ start: '00:00', end: '23:59' }],
    } })).json()
    baseId = base.id

    const hour = await familyHour(api)
    await loginUi(page)

    // 1. Settings -> Hours: add "Homework time", Other, Internet off, every day, around now, kid1 + group
    await page.goto('/settings?section=hours')
    await page.getByRole('button', { name: 'Add window' }).click()
    await page.getByLabel('Name', { exact: true }).fill(ruleName)
    await page.getByRole('button', { name: 'Other hours' }).click()
    await page.getByRole('button', { name: 'Internet off' }).click()
    await page.getByRole('switch', { name: 'Everyone' }).click()
    await page.getByRole('group', { name: 'Kids' }).getByRole('button', { name: `kid1 ${tag}` }).click()
    await page.getByRole('group', { name: 'Groups' }).getByRole('button', { name: `Study ${tag}` }).click()
    // a range that always covers now, without wrapping past midnight when possible
    const [from, to] = hour === 0 ? ['00:00', '23:59'] : [hhmm(0), hhmm(23, 59)]
    await page.getByLabel('Start 1').fill(from)
    await page.getByLabel('End 1').fill(to)
    await page.getByRole('button', { name: 'Save' }).click()

    const row = page.locator('.ph-row', { hasText: ruleName })
    await expect(row).toBeVisible()
    await expect(row.locator('[data-kind="off"]').first()).toBeVisible()
    ruleId = (await (await api.get('/api/proxy/hours')).json()).rules.find((r: { name: string }) => r.name === ruleName)?.id

    // 2. the kid's device locks (the blocker's loop ticks, so poll)
    const open = async () => {
      await page.goto(`/devices?item=${deviceId}`)
      await expect(page.getByRole('heading', { name: `Kid1 tablet ${tag}` })).toBeVisible()
    }
    const right = page.getByRole('region', { name: 'Right now' })
    const state = right.locator('.pk-kv', { hasText: 'State' })
    await expect(async () => {
      await open()
      await expect(state).toContainText('Locked', { timeout: 10_000 })
    }).toPass({ timeout: 90_000, intervals: [1_000] })
    await expect(right.getByText('Outside allowed hours')).toBeVisible()

    // 3. one edit (a range that excludes now) opens it again
    const gone = hour >= 12 ? ['01:00', '02:00'] : ['22:00', '23:00']
    await page.goto('/settings?section=hours')
    await page.getByRole('button', { name: `Edit ${ruleName}` }).click()
    await page.getByLabel('Start 1').fill(gone[0])
    await page.getByLabel('End 1').fill(gone[1])
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByRole('button', { name: 'Save' })).toBeHidden()
    await expect(async () => {
      await open()
      await expect(state).toContainText('Open', { timeout: 10_000 })
    }).toPass({ timeout: 90_000, intervals: [1_000] })

    // 4. lock, then unlock 30 min: Activity -> Lock history shows both
    await page.getByRole('button', { name: 'Lock now' }).click()
    await expect(state).toContainText('Locked')
    await page.getByRole('button', { name: 'Unlock 30 min' }).click()
    await expect(state).toContainText('Open')
    await page.getByRole('button', { name: 'Activity' }).click()
    const log = page.getByRole('region', { name: 'Lock history' })
    await expect(async () => {
      await page.reload()
      await page.getByRole('button', { name: 'Activity' }).click()
      await expect(log.getByText('Locked by Lab Parent')).toBeVisible({ timeout: 10_000 })
      // newest first: the unlock reads "Unlocked … by <parent>" when chores apply, else "Opened by schedule"
      await expect(log.locator('.pk-kv').first()).toContainText(/Unlocked .*by Lab Parent|Opened by schedule/, { timeout: 10_000 })
    }).toPass({ timeout: 90_000, intervals: [1_000] })

    // 5. the group lists the rule under Hours for this group
    await page.goto(`/devices?tab=groups&item=${groupId}`)
    const hours = page.getByRole('region', { name: 'Hours' })
    await expect(hours.getByText('Hours for this group')).toBeVisible()
    await expect(hours.getByText(ruleName)).toBeVisible()
  } finally {
    if (baseId) await api.delete(`/api/proxy/hours/${baseId}`)
    if (ruleId) await api.delete(`/api/proxy/hours/${ruleId}`)
    if (groupId) await api.delete(`/api/proxy/groups/${groupId}`)
    if (deviceId) await api.delete(`/api/proxy/devices/${deviceId}`)
    await undoKid()
  }
})
