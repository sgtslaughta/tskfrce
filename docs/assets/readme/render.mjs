// Renders collage.html to light/dark PNGs: node render.mjs <collage.html> <outDir>
// Copy into frontend/ first so `@playwright/test` resolves (see README.md).
import { chromium } from '@playwright/test'
import path from 'path'
const [,, src, out] = process.argv
const b = await chromium.launch()
for (const theme of ['dark', 'light']) {
  const p = await b.newPage({ viewport: { width: 1260, height: 900 }, deviceScaleFactor: 1.5 })
  await p.goto(`file://${path.resolve(src)}?theme=${theme}`, { waitUntil: 'networkidle' })
  await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(500)
  for (const id of ['kids', 'parents', 'devices'])
    await p.locator('#' + id).screenshot({ path: path.join(out, `${id}-${theme}.png`), omitBackground: true })
  await p.close()
}
await b.close()
