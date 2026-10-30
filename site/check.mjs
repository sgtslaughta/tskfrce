// Smoke check for the static site. Build the guide first, then serve site/ and run:
//   python3 scripts/build_site.py
//   python3 -m http.server 8811 --directory site &
//   node site/check.mjs [http://127.0.0.1:8811]
// Checks every page at 1280 and 390 px, light and dark: no horizontal scroll, no console
// errors, nothing wider than the screen (outside scroll boxes), buttons at least 32 px tall
// (44 for page buttons by CSS), DM Sans loaded, and every local link, #anchor and image resolves.
import { createRequire } from 'node:module'

const require = createRequire(new URL('../frontend/package.json', import.meta.url))
const { chromium } = require('playwright')

const BASE = (process.argv[2] || 'http://127.0.0.1:8811').replace(/\/$/, '')
const CHAPTERS = ['01-what-you-need', '02-install', '03-first-setup', '04-everyday-use', '05-for-kids', '06-troubleshooting', '07-faq', 'remote-access']
const PAGES = ['/', '/engineering.html', '/guide/', ...CHAPTERS.map((c) => `/guide/${c}.html`)]
const problems = []

const browser = await chromium.launch()
for (const path of PAGES) {
  for (const width of [1280, 390]) {
    for (const colorScheme of ['light', 'dark']) {
      const ctx = await browser.newContext({ viewport: { width, height: 900 }, colorScheme })
      const page = await ctx.newPage()
      const tag = `${path} ${width} ${colorScheme}`
      page.on('console', (m) => m.type() === 'error' && problems.push(`${tag}: console ${m.text()}`))
      const res = await page.goto(BASE + path, { waitUntil: 'networkidle' })
      if (!res || !res.ok()) problems.push(`${tag}: HTTP ${res?.status()}`)
      await page.evaluate(() => document.fonts.ready)
      const r = await page.evaluate(() => ({
        scroll: document.documentElement.scrollWidth,
        font: document.fonts.check('16px "DM Sans"'),
        small: [...document.querySelectorAll('.f-btn, .f-back, .copy-btn')]
          .filter((el) => el.offsetParent && el.getBoundingClientRect().height < 32)
          .map((el) => el.textContent.trim()),
        // html hides sideways overflow, so look for boxes that poke out (scroll boxes may hold wide content)
        wide: [...document.querySelectorAll('body *')]
          .filter((el) => el.getClientRects().length && el.getBoundingClientRect().right > innerWidth + 1)
          .filter((el) => !el.closest('pre, .arch-scroll, .guide-body table, [hidden]'))
          .slice(0, 3)
          .map((el) => `${el.tagName.toLowerCase()}.${el.className}`),
      }))
      if (r.scroll > width) problems.push(`${tag}: horizontal scroll (${r.scroll}px)`)
      if (!r.font) problems.push(`${tag}: DM Sans not loaded`)
      if (r.small.length) problems.push(`${tag}: small targets ${r.small.join(', ')}`)
      if (r.wide.length) problems.push(`${tag}: wider than the screen ${r.wide.join(', ')}`)
      await ctx.close()
    }
  }
}

// every local link and image on each page must resolve
const page = await browser.newPage()
const seen = new Set()
const bodies = new Map()
for (const path of PAGES) {
  await page.goto(BASE + path)
  const urls = await page.evaluate(() =>
    [...document.querySelectorAll('a[href], img[src]')]
      .map((el) => el.href || el.src)
      .filter((u) => u.startsWith(location.origin)),
  )
  for (const u of urls) {
    const [clean, hash] = u.split('#')
    if (!seen.has(clean)) {
      seen.add(clean)
      const res = await page.request.get(clean)
      if (!res.ok()) problems.push(`${path}: broken ${clean} (${res.status()})`)
      else if (/\.html$|\/$/.test(clean)) bodies.set(clean, await res.text())
    }
    if (hash && bodies.has(clean) && !bodies.get(clean).includes(`id="${decodeURIComponent(hash)}"`))
      problems.push(`${path}: missing anchor ${u}`)
  }
}
await browser.close()

if (problems.length) {
  console.error(problems.join('\n'))
  process.exit(1)
}
console.log(`site ok: ${PAGES.length} pages x 4 views, ${seen.size} local links`)
