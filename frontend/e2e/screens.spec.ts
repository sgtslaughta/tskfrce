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
]
const PUBLIC_ROUTES = ['/login', '/register', '/kid']

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
      () => document.documentElement.scrollWidth > window.innerWidth,
    )
    await page.screenshot({
      path: `e2e-artifacts/screens/${project}/${slug(route)}.png`,
      fullPage: true,
    })
    expect(wide, `${route} scrolls sideways`).toBe(false)
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
    await page.screenshot({ path: `e2e-artifacts/screens/${info.project.name}/bell-open.png` })
  })

  test('chat dock open', async ({ page }, info) => {
    await loginUi(page)
    await page.goto('/')
    await page.getByRole('button', { name: /^Chat/ }).click()
    await page.waitForTimeout(600)
    await page.screenshot({ path: `e2e-artifacts/screens/${info.project.name}/chat-dock.png` })
  })

  test('setup wizard', async ({ page }, info) => {
    await page.route('**/api/proxy/setup', (r) =>
      r.request().method() === 'GET' ? r.fulfill({ json: { needed: true } }) : r.continue(),
    )
    await page.goto('/setup')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(500)
    await page.screenshot({ path: `e2e-artifacts/screens/${info.project.name}/setup.png`, fullPage: true })
  })

  // The e2e container is a lab device: give it to Pat so the kid screens render.
  test('kid pages', async ({ page }, info) => {
    const api = await parentApi()
    const dir = `e2e-artifacts/screens/${info.project.name}`
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
})
