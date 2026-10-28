/** Focus a page landmark (focusable even without a tab stop) so keyboard users don't drop to <body>. */
export function focusPage(...selectors: string[]): void {
  for (const s of selectors) {
    const el = document.querySelector<HTMLElement>(s)
    if (!el) continue
    if (!el.hasAttribute('tabindex')) el.tabIndex = -1
    el.focus()
    return
  }
}
