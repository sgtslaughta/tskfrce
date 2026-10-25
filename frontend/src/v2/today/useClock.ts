import { useFamily } from '../hooks/useFamily'

/** "5:40 PM" in the family's time zone (not the browser's), so "Locks at" matches what the box enforces. */
export function useClock(): (iso?: string | null) => string {
  const tz = useFamily().data?.timezone
  return (iso) => {
    if (!iso) return ''
    try {
      return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: tz })
    } catch {
      return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    }
  }
}
