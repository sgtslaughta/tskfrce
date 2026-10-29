import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Icon } from './Icon'
import { useOnline } from '../hooks/useOnline'
import { agoText, summarize, type Freshness as F } from './freshness'

const SHOW_AFTER_MS = 700 // quick background polls shouldn't flash the line

function useFreshness(): F {
  const qc = useQueryClient()
  const read = () => summarize(qc.getQueryCache().getAll().filter((q) => q.getObserversCount() > 0).map((q) => q.state))
  const [f, setF] = useState<F>(read)
  useEffect(() => {
    const sync = () =>
      setF((old) => {
        const n = read()
        return old.updating === n.updating && old.failed === n.failed && old.since === n.since ? old : n
      })
    sync()
    // cache events fire while other components render (new observers); defer so we never setState mid-render
    let t: ReturnType<typeof setTimeout> | undefined
    const unsub = qc.getQueryCache().subscribe(() => {
      clearTimeout(t)
      t = setTimeout(sync, 0)
    })
    return () => {
      clearTimeout(t)
      unsub()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qc])
  return f
}

/** Mockup 05: small "Updating… last updated 10s ago" line and the amber "Update failed" banner. */
export function Freshness() {
  const qc = useQueryClient()
  const { updating, since, failed } = useFreshness()
  const online = useOnline()
  const [slow, setSlow] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!updating) return setSlow(false)
    const t = setTimeout(() => {
      setNow(Date.now())
      setSlow(true)
    }, SHOW_AFTER_MS)
    return () => clearTimeout(t)
  }, [updating])

  if (!online) return null // the offline banner already says it
  if (failed)
    return (
      <div className="p-banner" role="alert">
        <div className="p-banner-title">
          <Icon name="sync_problem" />
          Couldn&apos;t update
          <span className="p-banner-acts">
            <button
              type="button"
              className="p-btn"
              onClick={() => void qc.refetchQueries({ type: 'active', predicate: (q) => q.state.status === 'error' && q.state.data !== undefined })}
            >
              Retry
            </button>
          </span>
        </div>
        <div className="p-banner-body">Showing what we had. Your changes are safe.</div>
      </div>
    )
  if (!updating || !slow) return null
  return (
    <div className="p-updating" role="status">
      <span className="p-gate-spin" aria-hidden="true" />
      Updating… <span>last updated {agoText(now - since)}</span>
    </div>
  )
}
