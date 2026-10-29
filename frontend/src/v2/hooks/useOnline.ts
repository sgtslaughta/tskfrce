import { useSyncExternalStore } from 'react'

const watch = (cb: () => void) => {
  window.addEventListener('online', cb)
  window.addEventListener('offline', cb)
  return () => {
    window.removeEventListener('online', cb)
    window.removeEventListener('offline', cb)
  }
}

/** false while this device has no network (the browser's own report). Server and first paint assume online. */
export const useOnline = () =>
  useSyncExternalStore(watch, () => navigator.onLine, () => true)
