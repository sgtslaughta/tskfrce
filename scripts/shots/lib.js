const { chromium } = require('/w/node_modules/playwright')
const B = 'http://127.0.0.1:3777', API = 'http://127.0.0.1:8777'
const H = { 'content-type': 'application/json', 'x-internal-token': 'shottoken' }
const ping = () => fetch(API + '/api/v1/internal/state', { headers: H })
let tok
const api = async (p, method = 'GET', body) => {
  tok ??= (await (await fetch(API + '/api/v1/auth/login', { method: 'POST', headers: H, body: JSON.stringify({ username: 'sam', password: 'rivera-demo-2026' }) })).json()).access_token
  const r = await fetch(API + '/api/v1' + p, { method, headers: { ...H, authorization: 'Bearer ' + tok }, body: body && JSON.stringify(body) })
  return r.json().catch(() => null)
}
const shot = async (page, name, opts = {}) => {
  await ping(); await page.addStyleTag({ content: 'nextjs-portal{display:none!important}' }); await page.waitForTimeout(500)
  await page.screenshot({ path: `/s/shots/${name}.png`, ...opts })
}
module.exports = { chromium, B, API, api, shot, ping }
