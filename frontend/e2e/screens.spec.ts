import { expect, test } from '@playwright/test'
import { loginUi } from './seed'

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
})
