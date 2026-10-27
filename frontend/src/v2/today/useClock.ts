import { useEffect, useState } from 'react'
import { clockText } from '../clockText'
import { useFamily } from '../hooks/useFamily'

/** "5:40 PM" in the family's time zone (not the browser's), so "Locks at" matches what the box enforces. */
export function useClock(): (iso?: string | null) => string {
  const tz = useFamily().data?.timezone
  return (iso) => {
    if (!iso) return ''
    return clockText(iso, tz)
  }
}

/** Current time in ms, re-read every 30 s so "Due in N min" and "Overdue" chips move on their own. */
export function useNow(): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(t)
  }, [])
  return now
}
