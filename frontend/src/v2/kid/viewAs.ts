/** Parent "View as kid" link that remembers where it came from. */
export const viewAs = (id: number, from?: string) => `/kid?as=${id}${from ? `&back=${encodeURIComponent(from)}` : ''}`

/** Where "Back to parent" goes: the page it came from (same origin only, judged after URL parsing), else that kid's Today. */
export function backFrom(back: unknown, id: number): string {
  const home = `/?item=${id}`
  if (typeof back !== 'string' || !back.startsWith('/') || /[\x00-\x1f\\]/.test(back)) return home
  try {
    const u = new URL(back, window.location.origin)
    const path = u.pathname + u.search + u.hash
    // "/.//evil.com" normalizes to "//evil.com", which the browser reads as another host
    return u.origin === window.location.origin && !path.startsWith('//') ? path : home
  } catch {
    return home
  }
}
