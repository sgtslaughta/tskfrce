import { useState } from 'react'
import { useApproveAll, useDecideRedemption, usePendingRedemptions, useRewards } from '@/v2/hooks/useRewards'
import { Icon } from '@/v2/parent/Icon'
import { EmptyState, ErrorPanel, Skeleton } from '@/v2/parent/states'
import type { PendingRedemption } from '@/v2/types'
import { initial } from './choreMeta'
import { rewardGlyph } from './RewardDetail'
import { toastFail, toastOk, withUndo } from '../notify'

const clock = (d: Date) => d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })

/** "5:51 PM" today, "yesterday", else "Mon 5:51 PM". */
export function askedAt(iso: string, now = new Date()) {
  const d = new Date(iso)
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const diff = Math.round((day(now) - day(d)) / 86400000)
  if (diff === 0) return clock(d)
  if (diff === 1) return 'yesterday'
  return `${d.toLocaleDateString(undefined, { weekday: 'short' })} ${clock(d)}`
}

function RequestCard({ req, glyph, hide }: { req: PendingRedemption; glyph: string; hide: (on: boolean) => void }) {
  const decide = useDecideRedemption()
  const [note, setNote] = useState('')
  const short = req.kid_balance_after < 0
  const kid = req.kid_name ?? 'Kid'
  const send = (approve: boolean) => {
    const v = { id: req.id, approve, ...(note.trim() && { note: note.trim() }) }
    if (!approve) return decide.mutate(v, { onSuccess: () => toastOk(`Declined ${req.name}`), onError: toastFail })
    hide(true)
    void withUndo(() => decide.mutateAsync(v), `Approved ${req.name}`).finally(() => hide(false))
  }
  return (
    <article className="rw-rq" aria-label={`${req.name} for ${kid}`}>
      <span className="rw-glyph">
        <Icon name={glyph} size={24} />
      </span>
      <div className="rw-t2">
        {req.name}
        <small>
          <span className="rw-avx" aria-hidden="true">
            {initial(kid)}
          </span>
          {kid} · asked {askedAt(req.created_at)}
        </small>
      </div>
      <div className="rw-math">
        {req.cost} pts
        <b>
          {req.kid_balance} → <span className={short ? 'rw-short' : undefined}>{req.kid_balance_after}</span>
        </b>
      </div>
      <div className="rw-ra">
        <button type="button" className="p-btn" data-variant="accent" disabled={short || decide.isPending} onClick={() => send(true)}>
          <Icon name="check" />
          Approve
        </button>
        <button type="button" className="p-btn" disabled={decide.isPending} onClick={() => send(false)}>
          <Icon name="close" />
          Decline
        </button>
        <input className="rw-note" placeholder="Add a note (optional)…" aria-label={`Note to ${kid}`} maxLength={200} value={note} onChange={(e) => setNote(e.currentTarget.value)} />
        {short && (
          <span className="rw-short rw-short-msg">
            <Icon name="error" size={16} />
            Not enough points
          </span>
        )}
      </div>
    </article>
  )
}

/** Requests pane: pending reward and screen-time requests with Approve all. */
export function RewardsRequests({ onHistory }: { onHistory: () => void }) {
  const pending = usePendingRedemptions()
  const rewards = useRewards().data ?? []
  const approveAll = useApproveAll()
  const [hidden, setHidden] = useState<number[]>([])
  const list = (pending.data ?? []).filter((r) => !hidden.includes(r.id))
  const glyphOf = (r: PendingRedemption) => (r.kind === 'screen_time' ? 'timer' : rewardGlyph(rewards.find((x) => x.name === r.name)?.icon))
  const all = () =>
    approveAll.mutate(undefined, {
      onError: toastFail,
      onSuccess: (data) => {
        // useInvalidating erases the response type
        const r = data as { approved: number; skipped: number }
        toastOk(`Approved ${r.approved}${r.skipped ? `, ${r.skipped} skipped (not enough points)` : ''}`)
      },
    })
  return (
    <div className="pk-detail">
      <header className="pk-head">
        <div className="pk-head-t">
          <h2>Requests</h2>
          <div className="p-header-chips">
            <span className="p-header-chip" data-tone="lav">
              <Icon name="hourglass_top" size={16} />
              {list.length} waiting
            </span>
            <span className="p-header-chip">
              <Icon name="stars" size={16} />
              Points paid on approve
            </span>
          </div>
        </div>
        <button type="button" className="p-btn" disabled={!list.length || approveAll.isPending} onClick={all}>
          <Icon name="done_all" />
          Approve all
        </button>
      </header>
      {pending.isPending ? (
        <Skeleton />
      ) : pending.isError ? (
        <ErrorPanel kind="unreachable" error={pending.error} onRetry={() => pending.refetch()} />
      ) : list.length ? (
        list.map((r) => (
          <RequestCard key={r.id} req={r} glyph={glyphOf(r)} hide={(on) => setHidden((h) => (on ? [...h, r.id] : h.filter((x) => x !== r.id)))} />
        ))
      ) : (
        <EmptyState icon="done_all" title="No requests" body="When a kid asks for a reward it shows up here." />
      )}
      <button type="button" className="p-btn rw-self-start" onClick={onHistory}>
        <Icon name="history" />
        See history
      </button>
    </div>
  )
}
