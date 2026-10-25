/**
 * Guards against UI that passes jsdom tests but renders unstyled:
 * every p-* class used in components must be defined in a stylesheet
 * loaded by pages/_app.tsx, and the icon font rule must be loaded.
 */
import fs from 'fs'
import path from 'path'

const root = path.join(__dirname, '../..')
const walk = (dir: string, ext: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) return e.name === 'node_modules' ? [] : walk(p, ext)
    return p.endsWith(ext) ? [p] : []
  })

const app = fs.readFileSync(path.join(root, 'pages/_app.tsx'), 'utf8')
const loadedCss = [...app.matchAll(/import '(\.\.\/src\/[^']+\.css)'/g)]
  .map((m) => fs.readFileSync(path.join(root, 'pages', m[1]), 'utf8'))
  .join('\n')
const moduleCss = walk(path.join(root, 'src'), '.module.css').map((f) => fs.readFileSync(f, 'utf8')).join('\n')
const css = loadedCss + moduleCss

const used = new Set(
  [...walk(path.join(root, 'src'), '.tsx'), ...walk(path.join(root, 'pages'), '.tsx')].flatMap((f) =>
    [...fs.readFileSync(f, 'utf8').matchAll(/(?<![-\w])p-[a-z0-9]+(?:-[a-z0-9]+)*/g)].map((m) => m[0]),
  ),
)
const defined = new Set([...css.matchAll(/\.(p-[a-z0-9]+(?:-[a-z0-9]+)*)/g)].map((m) => m[1]))

// Screens still being styled. Remove entries as they get CSS; never add new ones.
const PENDING = new Set(
  `p-all-badges p-badges-grid p-badges-pages p-catalogue p-custom-badges p-glyph-grid
  p-glyph-item p-glyph-label p-glyph-picker p-glyph-search p-history p-kid-actions p-kid-detail
  p-kid-header p-kid-meta p-list p-list-badges p-list-content p-list-item p-list-meta p-list-selected
  p-list-title p-list-value p-recent-awards p-request-actions p-request-balance p-request-card
  p-request-cost p-request-header p-request-kid p-request-name p-requests p-reward-card p-reward-grid
  p-reward-icon p-reward-name p-reward-price p-rewards-pages p-screen-time
  p-thread-row`.split(/\s+/),
)

describe('css coverage', () => {
  it('every p-* class used in components is styled by a loaded stylesheet', () => {
    const missing = [...used].filter((c) => !defined.has(c) && !PENDING.has(c)).sort()
    expect(missing).toEqual([])
  })

  it('pending list only holds classes that are still unstyled', () => {
    const stale = [...PENDING].filter((c) => defined.has(c)).sort()
    expect(stale).toEqual([])
  })

  it('loads the Material Symbols font rule for .ms icons', () => {
    expect(app).toContain("import 'material-symbols/rounded.css'")
    expect(loadedCss).toMatch(/\.ms\s*\{[^}]*font-family:\s*'Material Symbols Rounded'/)
  })
})
