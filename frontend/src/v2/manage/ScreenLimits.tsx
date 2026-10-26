import { useState } from 'react'
import { useDeleteLimit, useSetLimit } from '@/v2/hooks/useScreenTime'
import { Icon } from '@/v2/parent/Icon'
import type { ScreenKid } from '@/v2/types'
import { intError } from './choreMeta'
import { toastFail, toastOk } from '../notify'

/** "No max", then 15…240 in 15s (plus `keep` when it is off that list). */
export function MaxOptions({ keep }: { keep?: number | null }) {
  const steps = Array.from({ length: 16 }, (_, i) => (i + 1) * 15)
  if (keep && !steps.includes(keep)) steps.push(keep)
  return (
    <>
      <option value="">No max</option>
      {steps.map((n) => (
        <option key={n} value={n}>
          {n} min
        </option>
      ))}
    </>
  )
}

type Limit = NonNullable<ScreenKid['limit']>

/** "Max 30 min/day · Not allowed until 100 pts" */
export const limitText = (l: Limit) =>
  [l.max_minutes && `Max ${l.max_minutes} min/day`, l.min_points && `Not allowed until ${l.min_points} pts`].filter(Boolean).join(' · ')

function LimitForm({ kids, kid, onDone }: { kids: ScreenKid[]; kid?: ScreenKid; onDone: () => void }) {
  const setLimit = useSetLimit()
  const [kidId, setKidId] = useState(String(kid?.kid_id ?? kids[0]?.kid_id ?? ''))
  const [max, setMax] = useState(String(kid?.limit?.max_minutes ?? ''))
  const [min, setMin] = useState(String(kid?.limit?.min_points ?? ''))
  const minErr = min.trim() ? intError(min, 1, 100000) : ''
  const body = { max_minutes: max ? Number(max) : null, min_points: min.trim() ? Number(min) : null }
  const ok = kidId && !minErr && (body.max_minutes != null || body.min_points != null)
  const save = () =>
    setLimit.mutate({ kidId: Number(kidId), body }, { onError: toastFail, onSuccess: () => (toastOk('Saved'), onDone()) })
  return (
    <div className="pk-sub" role="group" aria-label={kid ? `${kid.name}'s limit` : 'New limit'}>
      <div className="rw-form rw-form3">
        <label className="pk-field">
          <span className="pk-label">Kid</span>
          <select className="pk-input" aria-label="Kid" value={kidId} disabled={!!kid} onChange={(e) => setKidId(e.currentTarget.value)}>
            {(kid ? [kid] : kids).map((k) => (
              <option key={k.kid_id} value={k.kid_id}>
                {k.name ?? 'Kid'}
              </option>
            ))}
          </select>
        </label>
        <label className="pk-field">
          <span className="pk-label">Max per day</span>
          <select className="pk-input" aria-label="Max per day" value={max} onChange={(e) => setMax(e.currentTarget.value)}>
            <MaxOptions keep={kid?.limit?.max_minutes} />
          </select>
        </label>
        <label className="pk-field">
          <span className="pk-label">Minimum points</span>
          <input className="pk-input" aria-label="Minimum points" inputMode="numeric" placeholder="Optional" value={min} aria-invalid={!!minErr} onChange={(e) => setMin(e.currentTarget.value)} />
          {minErr && <span className="pk-error">{minErr}</span>}
        </label>
      </div>
      <div className="pk-actions">
        <button type="button" className="p-btn" data-variant="accent" disabled={!ok || setLimit.isPending} aria-busy={setLimit.isPending} onClick={save}>
          <Icon name="check" />
          Save limit
        </button>
        <button type="button" className="p-btn" onClick={onDone}>
          Cancel
        </button>
      </div>
    </div>
  )
}

/** Per-kid limits card: list, edit, remove, Add a limit. */
export function ScreenLimits({ kids }: { kids: ScreenKid[] }) {
  const del = useDeleteLimit()
  const [editing, setEditing] = useState<number | 'new' | null>(null)
  const limited = kids.filter((k) => k.limit)
  const free = kids.filter((k) => !k.limit)
  const remove = (k: ScreenKid) => del.mutate(k.kid_id, { onError: toastFail, onSuccess: () => toastOk(`Removed ${k.name}'s limit`) })
  return (
    <section className="pk-panel rw-rows" aria-label="Per-kid limits">
      <h3>
        <Icon name="person" size={18} className="rw-h3i" />
        Per-kid limits
      </h3>
      {limited.map((k) =>
        editing === k.kid_id ? (
          <LimitForm key={k.kid_id} kids={kids} kid={k} onDone={() => setEditing(null)} />
        ) : (
          <div key={k.kid_id} className="rw-kv">
            <span>{k.name ?? 'Kid'}</span>
            <span className="rw-limit">
              {limitText(k.limit as Limit)}
              <button type="button" className="rw-ib" aria-label={`Edit ${k.name}'s limit`} onClick={() => setEditing(k.kid_id)}>
                <Icon name="edit" size={16} />
              </button>
              <button type="button" className="rw-ib" aria-label={`Remove ${k.name}'s limit`} disabled={del.isPending} onClick={() => remove(k)}>
                <Icon name="close" size={16} />
              </button>
            </span>
          </div>
        ),
      )}
      {editing === 'new' ? (
        <LimitForm kids={free} onDone={() => setEditing(null)} />
      ) : (
        free.length > 0 && (
          <div className="rw-kv">
            <button type="button" className="rw-addlink" onClick={() => setEditing('new')}>
              <Icon name="add" size={16} />
              Add a limit
            </button>
          </div>
        )
      )}
    </section>
  )
}
