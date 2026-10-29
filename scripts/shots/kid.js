const { chromium, B, api, shot } = require('./lib.js')
;(async () => {
  await api('/devices/1', 'PATCH', { status: 'assigned', owner_ids: [3] })
  await api('/devices/1/override', 'POST', { action: 'lock', minutes: 120 })
  const br = await chromium.launch()
  const page = await (await br.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: 'light' })).newPage()
  await page.goto(B + '/kid'); await page.waitForLoadState('networkidle'); await page.waitForTimeout(2500)
  for (let i = 0; i < 4; i++) { const b = page.getByRole('button', { name: /nice|awesome|cool|yay|ok|great|got it/i }).first(); if (await b.count()) { await b.click(); await page.waitForTimeout(800) } }
  const dy = (await page.getByText('Clean your desk').first().boundingBox()).y
  await shot(page, 'kid-today', { fullPage: true, clip: { x: 0, y: 0, width: 390, height: Math.round(dy - 12) } })
  await page.getByText('Clean your desk').first().click(); await page.waitForTimeout(800)
  const by = (await page.getByText('Clean your desk').first().boundingBox()).y + await page.evaluate(() => scrollY)
  await shot(page, 'kid-chore', { fullPage: true, clip: { x: 0, y: Math.round(by - 100), width: 390, height: 440 } })
  await page.getByRole('button', { name: /customize/i }).first().click(); await page.waitForTimeout(1200)
  await shot(page, 'kid-locker', { fullPage: true, clip: { x: 0, y: 0, width: 390, height: 520 } })
  await br.close()
})().catch(e => { console.error(e); process.exit(1) })
