import { expect, request, test, type APIRequestContext } from '@playwright/test'
import { loginUi, parentApi } from './seed'

const BASE = process.env.E2E_BASE_URL ?? 'http://10.99.0.5:3000'
// the lab container registers as a device named like this; kid actions need a kid token from it
const DEVICE = process.env.E2E_KID_DEVICE ?? 'e2e-run'

test.use({ actionTimeout: 15_000 })

async function kidApi(token: string): Promise<APIRequestContext> {
  return request.newContext({ baseURL: BASE, extraHTTPHeaders: { Authorization: `Bearer ${token}` } })
}

// Journey: screen time + no-approval reward bought by a kid -> History "Auto" -> badge award -> family chat.
test('rewards, screen time, badges and chat', async ({ page }) => {
  const api = await parentApi()
  const tag = Date.now().toString(36).slice(-4)
  const first = `Zed${tag}`
  const rewardName = `E2E treat ${tag}`
  const badgeName = `E2E star ${tag}`
  const note = `Great teamwork ${tag}`
  const choreName = `E2E chat chore ${tag}`
  const hello = `hello ${tag}`

  const devs: { id: number; name: string; owner_ids: number[] }[] = await (await api.get('/api/proxy/devices')).json()
  const dev = devs.find((d) => d.name.includes(DEVICE))
  if (process.env.E2E_KID_TOKEN) expect(dev, 'lab e2e device registered').toBeTruthy()
  else test.skip(!dev, `no device named like "${DEVICE}" (set E2E_KID_DEVICE)`)

  const before = await (await api.get('/api/proxy/screen-time')).json()
  const kid = await (await api.post('/api/proxy/kids', { data: { full_name: `${first} Kid` } })).json()
  const setOwners = (ids: number[]) => api.patch(`/api/proxy/devices/${dev!.id}`, { data: { owner_ids: ids } })
  let rewardId: number | undefined
  let badgeId: number | undefined
  let choreId: number | undefined

  try {
    await api.post(`/api/proxy/kids/${kid.id}/points`, { data: { amount: 200, note: 'e2e' } })
    await setOwners([kid.id])

    await loginUi(page)

    // 1. screen time: price 20, max 30 min/day, approve automatically
    await page.goto('/kids?section=rewards&item=screen')
    await expect(page.getByRole('heading', { name: 'Screen time' })).toBeVisible()
    const how = page.getByRole('region', { name: 'How it works' })
    if (!(await how.getByRole('switch', { name: 'Kids can buy extra minutes' }).isChecked())) {
      await how.getByRole('switch', { name: 'Kids can buy extra minutes' }).click()
    }
    await how.getByLabel('Price (points per 15 min)').fill('20')
    await how.getByLabel('Max per day').selectOption('30')
    const auto = how.getByRole('switch', { name: 'Approve automatically' })
    if (!(await auto.isChecked())) await auto.click()
    const hours = how.getByRole('switch', { name: 'Only during allowed hours' })
    if (await hours.isChecked()) await hours.click() // the lab clock is not ours: don't depend on allowed hours
    await how.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByText('Saved').first()).toBeVisible()
    await expect(page.locator('.p-header-chip', { hasText: 'Max 30 min/day' })).toBeVisible()

    // 2. catalogue: a reward that needs no approval
    await page.goto('/kids?section=rewards&item=catalogue&pick=new')
    const form = page.getByRole('region', { name: 'Reward details' })
    await form.getByLabel('Reward', { exact: true }).fill(rewardName)
    await form.getByLabel('Price (points)').fill('30')
    await form.getByRole('switch', { name: 'Needs approval' }).click()
    await expect(form.getByText('Points come off right away and you get a ping.')).toBeVisible()
    await form.getByRole('button', { name: 'Add reward' }).click()
    await expect(page.getByRole('button', { name: new RegExp(rewardName) }).first()).toBeVisible()
    const rewards: { id: number; name: string }[] = await (await api.get('/api/proxy/rewards')).json()
    rewardId = rewards.find((r) => r.name === rewardName)?.id
    expect(rewardId, 'the reward exists').toBeTruthy()

    // 3. kid: the reward is instant, 30 min of screen time is auto-approved, then the daily max is hit
    const login = await (await request.newContext({ baseURL: BASE })).post('/api/proxy/kid/login', { data: { kid_id: kid.id } })
    expect(login.ok(), 'kid login from the e2e device').toBe(true)
    const k = await kidApi((await login.json()).access_token)
    const got = await k.post('/api/proxy/kid/redeem', { data: { kind: 'reward', reward_id: rewardId } })
    expect(got.ok()).toBe(true)
    expect((await got.json()).status).toBe('approved')
    const bought = await k.post('/api/proxy/kid/redeem', { data: { kind: 'screen_time', minutes: 30 } })
    expect(bought.ok()).toBe(true)
    expect((await bought.json()).status).toBe('approved')
    const more = await k.post('/api/proxy/kid/redeem', { data: { kind: 'screen_time', minutes: 15 } })
    expect(more.ok(), 'no more screen time today').toBe(false)
    await k.dispose()

    // 4. parent History shows both as Auto
    await page.goto('/kids?section=rewards&item=history')
    const rows = page.getByRole('region', { name: 'History rows' })
    await expect(rows.getByRole('listitem').filter({ hasText: rewardName }).locator('.p-chip', { hasText: 'Auto' })).toBeVisible()
    await expect(rows.getByRole('listitem').filter({ hasText: `${first} Kid` }).filter({ hasText: '30 min' }).locator('.p-chip', { hasText: 'Auto' })).toBeVisible()

    // 5. badges: award a custom badge with a note, see it under Recent
    badgeId = (await (await api.post('/api/proxy/custom-badges', { data: { name: badgeName, icon: 'military_tech' } })).json()).id
    await page.goto(`/kids?section=badges&item=custom&pick=${badgeId}`)
    const award = page.getByRole('region', { name: 'Award it' })
    await award.getByRole('button', { name: `${first} Kid`, exact: true }).click()
    await award.getByLabel(`Note to ${first} Kid (optional)`).fill(note)
    await award.getByRole('button', { name: `Award to ${first} Kid` }).click()
    await page.goto('/kids?section=badges&item=recent')
    await expect(page.getByText(`“${note}”`)).toBeVisible()

    // 6. family chat: mention from the menu, send, find the thread by message search
    await page.goto('/chat?item=family:family')
    await expect(page.getByRole('region', { name: 'Family', exact: true })).toBeVisible()
    const box = page.getByLabel('Message', { exact: true })
    await box.pressSequentially(`${hello} @${first.slice(0, 5)}`)
    await page.getByRole('option', { name: new RegExp(first) }).click()
    await expect(box).toHaveValue(new RegExp(`@${first} `))
    await page.getByRole('button', { name: 'Send' }).click()
    await expect(page.getByText(hello)).toBeVisible()
    // the text is only in a message body, so only a server body search can keep the Family row
    const list = page.getByRole('list', { name: 'Conversations' })
    const kidRow = list.getByRole('button', { name: new RegExp(`${first} Kid`) })
    await expect(kidRow).toBeVisible()
    await page.getByLabel('Search threads').fill(hello)
    await expect(list.getByRole('button', { name: /^Family/ })).toBeVisible()
    await expect(kidRow).toHaveCount(0)

    // 7. chore chat: a quick reply fills the box for editing, it does not send
    const chore = await (await api.post('/api/proxy/chores/', { data: { title: choreName, points: 10 } })).json()
    choreId = chore.id
    await api.post(`/api/proxy/chores/${chore.id}/assignments`, {
      data: { kid_ids: [kid.id], mode: 'each', repeat: { type: 'daily' } },
    })
    const today = await (await api.get('/api/proxy/chores/today')).json()
    const run = today[String(kid.id)].find((r: { title: string }) => r.title === choreName)
    await page.goto(`/chat?item=chore:${run.id}`)
    await expect(page.getByRole('region', { name: choreName })).toBeVisible()
    await page.getByRole('group', { name: 'Quick replies' }).getByRole('button', { name: 'Looks good' }).click()
    await expect(page.getByLabel('Message', { exact: true })).toHaveValue('Looks good')
    const thread = await (await api.get(`/api/proxy/chat/threads/chore/${run.id}`)).json()
    expect(thread.messages.filter((m: { body: string }) => m.body === 'Looks good')).toHaveLength(0)
  } finally {
    // leave the family thread as we found it
    try {
      const fam = await (await api.get('/api/proxy/chat/threads/family/family')).json()
      for (const m of fam.messages.filter((m: { body: string }) => m.body?.includes(hello))) {
        await api.delete(`/api/proxy/chat/messages/${m.id}`)
      }
    } catch {
      // best effort: the rest of the cleanup must still run
    }
    if (rewardId) await api.delete(`/api/proxy/rewards/${rewardId}`)
    if (choreId) await api.delete(`/api/proxy/chores/${choreId}`)
    if (badgeId) await api.delete(`/api/proxy/custom-badges/${badgeId}`)
    await setOwners(dev!.owner_ids)
    await api.delete(`/api/proxy/kids/${kid.id}`)
    await api.patch('/api/proxy/screen-time', {
      data: {
        enabled: before.enabled,
        price: before.price,
        max_minutes_per_day: before.max_minutes_per_day,
        auto_approve: before.auto_approve,
        only_in_allowed_hours: before.only_in_allowed_hours,
      },
    })
    await api.dispose()
  }
})
