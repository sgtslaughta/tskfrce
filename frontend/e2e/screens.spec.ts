import { expect, test } from '@playwright/test'
import { loginUi, parentApi } from './seed'

const PARENT_ROUTES = [
  '/',
  '/kids?section=chores',
  '/kids?section=kids',
  '/kids?section=rewards',
  '/kids?section=badges',
  '/devices',
  '/chat',
  '/settings',
  '/kids?section=rewards&item=screen',
  '/settings?section=hours',
  '/settings?section=notifications',
  '/more',
]
const PUBLIC_ROUTES = ['/login', '/register', '/kid']
const SHOTS = process.env.E2E_SHOTS_DIR ?? 'e2e-artifacts/screens'

const slug = (r: string) => (r === '/' ? 'today' : r.replace(/^\//, '').replace(/[/?=&]+/g, '-'))

test.describe('every screen', () => {
  let errors: string[]
  test.beforeEach(({ page }) => {
    errors = []
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
    page.on('pageerror', (e) => errors.push(e.message))
  })

  async function shoot(page: import('@playwright/test').Page, route: string, project: string) {
    await page.goto(route)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(500) // let web fonts and query data settle
    const wide = await page.evaluate(
      (w) => document.documentElement.scrollWidth > w,
      page.viewportSize()!.width, // not innerWidth: a too-wide page makes phones widen the viewport and hide the overflow
    )
    await page.screenshot({
      path: `${SHOTS}/${project}/${slug(route)}.png`,
      fullPage: true,
    })
    expect(wide, `${route} scrolls sideways`).toBe(false)
    // clipped overflow does not scroll, so also look for controls cut off at the right edge
    const cut = await page.evaluate((w) => {
      const scroller = (el: Element | null): boolean =>
        !!el && (['auto', 'scroll'].includes(getComputedStyle(el).overflowX) || scroller(el.parentElement))
      return Array.from(document.querySelectorAll('input, button, select, textarea'))
        .filter((el) => {
          const r = el.getBoundingClientRect()
          return r.width > 0 && r.height > 0 && r.right > w + 1 && !scroller(el.parentElement)
        })
        .map((el) => (el.getAttribute('aria-label') || el.textContent || el.tagName).trim().slice(0, 40))
    }, page.viewportSize()!.width)
    expect(cut, `${route} controls cut off at the right edge`).toEqual([])
    expect(errors, `${route} console errors`).toEqual([])
  }

  for (const route of PUBLIC_ROUTES) {
    test(`public ${route}`, async ({ page }, info) => {
      await shoot(page, route, info.project.name)
    })
  }

  test('parent routes', async ({ page }, info) => {
    await loginUi(page)
    errors = [] // the login page itself is covered above
    for (const route of PARENT_ROUTES) {
      await shoot(page, route, info.project.name)
      errors = []
    }
  })

  test('bell open', async ({ page }, info) => {
    await loginUi(page)
    await page.goto('/')
    await page.getByRole('button', { name: /^Notifications/ }).click()
    await expect(page.getByText('Notifications', { exact: true }).last()).toBeVisible()
    await page.waitForTimeout(500)
    await page.screenshot({ path: `${SHOTS}/${info.project.name}/bell-open.png` })
  })

  // v3: desktop logs out from the rail; phones reach settings and log out from the header initial -> More
  test('account and log out are reachable', async ({ page }, info) => {
    await loginUi(page)
    await page.goto('/')
    if (info.project.name.startsWith('phone')) {
      await page.getByRole('link', { name: 'Account and settings' }).click()
      await expect(page).toHaveURL(/\/more$/)
      await expect(page.getByRole('button', { name: 'Log out' })).toBeVisible()
    } else {
      await expect(page.getByRole('button', { name: /log out/i })).toBeVisible()
    }
    await page.screenshot({ path: `${SHOTS}/${info.project.name}/account.png` })
  })

  test('chat dock open', async ({ page }, info) => {
    test.skip(info.project.name.startsWith('phone'), 'phones use the Chat tab, not the floating dock')
    await loginUi(page)
    await page.goto('/')
    await page.getByRole('button', { name: /^Chat(,| *$)/ }).click()
    await page.waitForTimeout(600)
    await page.screenshot({ path: `${SHOTS}/${info.project.name}/chat-dock.png` })
  })

  test('setup wizard', async ({ page }, info) => {
    await page.route('**/api/proxy/setup', (r) =>
      r.request().method() === 'GET' ? r.fulfill({ json: { needed: true } }) : r.continue(),
    )
    await page.goto('/setup')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(500)
    const wide = await page.evaluate((w) => document.documentElement.scrollWidth > w, page.viewportSize()!.width)
    expect(wide, 'setup scrolls sideways').toBe(false)
    await page.screenshot({ path: `${SHOTS}/${info.project.name}/setup.png`, fullPage: true })
  })

  // The e2e container is a lab device: give it to Pat so the kid screens render.
  test('kid pages', async ({ page }, info) => {
    const api = await parentApi()
    const dir = `${SHOTS}/${info.project.name}`
    const find = async () => {
      const devs: { id: number; name: string }[] = await (await api.get('/api/proxy/devices')).json()
      return devs.filter((d) => d.name.includes('e2e-run'))
    }
    let devs = await find()
    for (let i = 0; i < 12 && !devs.length; i++) {
      await page.waitForTimeout(5000)
      devs = await find()
    }
    test.skip(!devs.length, 'e2e container device was not discovered by the blocker')
    const kids: { id: number; full_name: string }[] = await (await api.get('/api/proxy/kids')).json()
    const pat = kids.find((k) => k.full_name === 'Pat')!
    const own = (ids: number[]) =>
      Promise.all(devs.map((d) => api.patch(`/api/proxy/devices/${d.id}`, { data: { owner_ids: ids } })))
    await own([pat.id])
    try {
      await page.goto('/kid')
      await page.waitForLoadState('networkidle')
      await page.screenshot({ path: `${dir}/kid-pin.png`, fullPage: true })
      await page.keyboard.type('1234')
      await page.waitForTimeout(1500)
      await page.screenshot({ path: `${dir}/kid-home.png`, fullPage: true })
      await page.getByRole('button', { name: /customize/i }).first().click()
      await page.waitForTimeout(800)
      await page.screenshot({ path: `${dir}/kid-locker.png`, fullPage: true })
    } finally {
      await own([])
    }
  })

  test('kid page keeps fridge tokens', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop-light', 'run once on desktop light')
    const api = await parentApi()
    const find = async () => {
      const devs: { id: number; name: string }[] = await (await api.get('/api/proxy/devices')).json()
      return devs.filter((d) => d.name.includes('e2e-run'))
    }
    let devs = await find()
    for (let i = 0; i < 12 && !devs.length; i++) {
      await page.waitForTimeout(5000)
      devs = await find()
    }
    test.skip(!devs.length, 'e2e container device was not discovered by the blocker')
    const kids: { id: number; full_name: string }[] = await (await api.get('/api/proxy/kids')).json()
    const pat = kids.find((k) => k.full_name === 'Pat')!
    const own = (ids: number[]) =>
      Promise.all(devs.map((d) => api.patch(`/api/proxy/devices/${d.id}`, { data: { owner_ids: ids } })))
    await own([pat.id])
    try {
      await page.goto('/kid')
      await page.waitForLoadState('networkidle')
      await page.keyboard.type('1234')
      await page.waitForTimeout(1500)
      // check fridge tokens are intact
      const fridgeBg = await page.evaluate(() => {
        const style = getComputedStyle(document.documentElement)
        return style.getPropertyValue('--f-bg').trim()
      })
      expect(fridgeBg, 'kid page --f-bg should be #f4f7fa').toBe('#f4f7fa')
    } finally {
      await own([])
    }
  })
})
