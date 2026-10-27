import { useEffect, useState } from 'react'
import { api } from '@/v2/api'

export type LinkCheck<T> = { state: 'checking' } | { state: 'ok'; data: T } | { state: 'gone' } | { state: 'unknown' }

const GONE = [400, 404, 410]

/**
 * Ask the box whether an invite / reset link still works, when the page opens.
 * 'unknown' = the box didn't answer; the form still shows and the server judges on submit.
 */
export function useLinkCheck<T>(path: string | null): LinkCheck<T> {
  const [result, setResult] = useState<LinkCheck<T>>({ state: 'checking' })
  useEffect(() => {
    if (!path) return
    let live = true
    api<T>(path)
      .then((data) => live && setResult({ state: 'ok', data }))
      .catch((e: { status?: number }) => live && setResult({ state: GONE.includes(e?.status ?? 0) ? 'gone' : 'unknown' }))
    return () => {
      live = false
    }
  }, [path])
  return result
}
