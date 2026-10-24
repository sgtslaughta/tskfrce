// Renders welcome.html to transparent PNG frames: node render.mjs <outDir> [fps]
// Run from a directory where `playwright` resolves (e.g. frontend/).
import { chromium } from 'playwright'
import path from 'path'
import fs from 'fs'
const out = process.argv[2], fps = +(process.argv[3] || 20), dur = 12000
const src = 'file://' + path.join(path.dirname(new URL(import.meta.url).pathname), 'welcome.html')
const b = await chromium.launch()
for (const theme of ['light', 'dark']) {
  const dir = path.join(out, theme); fs.mkdirSync(dir, { recursive: true })
  const p = await b.newPage({ viewport: { width: 720, height: 400 }, deviceScaleFactor: 1 })
  await p.goto(`${src}?theme=${theme}`, { waitUntil: 'networkidle' })
  await p.evaluate(() => document.fonts.ready)
  const n = Math.round(dur / 1000 * fps)
  for (let i = 0; i < n; i++) {
    await p.evaluate(ms => document.getAnimations().forEach(a => { a.pause(); a.currentTime = ms }), i * 1000 / fps)
    await p.locator('#hero').screenshot({ path: path.join(dir, String(i).padStart(4, '0') + '.png'), omitBackground: true })
  }
  await p.close()
}
await b.close()
