/** Parent "View as kid" link that remembers where it came from. */
export const viewAs = (id: number, from?: string) => `/kid?as=${id}${from ? `&back=${encodeURIComponent(from)}` : ''}`

/** Where "Back to parent" goes: the page it came from (same-site paths only), else that kid's Today. */
export const backFrom = (back: unknown, id: number) =>
  typeof back === 'string' && back.startsWith('/') && !back.startsWith('//') && !back.startsWith('/\\') ? back : `/?item=${id}`
