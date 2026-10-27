const KEY = 'task4ce-session-expired'

/** Remember (for this tab) that the session ran out, so the login page can say so (mockup 05). */
export function markSessionExpired(): void {
  try {
    sessionStorage.setItem(KEY, '1')
  } catch {
    // storage blocked: the login page just won't show the note
  }
}

/** Read and clear the flag. */
export function takeSessionExpired(): boolean {
  try {
    const v = sessionStorage.getItem(KEY)
    sessionStorage.removeItem(KEY)
    return v === '1'
  } catch {
    return false
  }
}
