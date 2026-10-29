import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ApiError } from '../api'

/** The proxy answers 502 when the backend is down; fetch throws a TypeError when the app server is. */
export const isUnreachable = (e: unknown) => e instanceof TypeError || (e instanceof ApiError && e.status === 502)

/** false once a request can't reach the box, true again on the next successful one. */
export function useReachable(): boolean {
  const qc = useQueryClient()
  const [ok, setOk] = useState(true)
  useEffect(
    () =>
      qc.getQueryCache().subscribe((ev) => {
        if (ev.type !== 'updated') return
        const s = ev.query.state
        if (ev.action.type === 'error' && isUnreachable(s.error)) setOk(false)
        else if (ev.action.type === 'success') setOk(true)
      }),
    [qc],
  )
  return ok
}
