import { useEffect, useState } from 'react'
import { useDisclosure } from '@mantine/hooks'
import { useCopyChore, useDeleteChore, useSaveChore } from '@/v2/hooks/useChores'
import { Chip } from '@/v2/parent/Chip'
import { Icon } from '@/v2/parent/Icon'
import { choreIcon } from '@/v2/today/choreIcon'
import type { Kid, LibChore } from '@/v2/types'
import { ConfirmDelete } from './ConfirmDelete'
import { useSingle } from './useSingle'
import { WhoWhen } from './WhoWhen'
import { intError, schedules } from './choreMeta'
import { toastFail, toastOk } from '../notify'

interface Props {
  kids: Kid[]
  /** Omit to create a new chore. */
  chore?: LibChore
  /** Select a chore, or null to close the detail. */
  onSelect: (id: number | null) => void
}

const MAX_STEPS = 20 // backend limit
interface Draft { title: string; points: string; steps: string[]; next: string; photo: boolean }
/** Unsaved edits per chore id ('new' for a chore not saved yet), kept while the editor is unmounted. */
const drafts = new Map<string, Draft>()
/** Forget all kept drafts (tests). */
export const clearChoreDrafts = () => drafts.clear()

/** Chore editor laid out as cards: header, Basics, Steps and Who & when. */
export function ChoreDetail({ kids, chore, onSelect }: Props) {
  const save = useSaveChore()
  const saveOnce = useSingle(save)
  const del = useDeleteChore()
  const delOnce = useSingle(del)
  const copy = useCopyChore()
  const copyOnce = useSingle(copy)
  const [confirm, { open, close }] = useDisclosure(false)
  const key = String(chore?.id ?? 'new')
  const kept = drafts.get(key)
  const [restored] = useState(!!kept)
  const [title, setTitle] = useState(kept?.title ?? chore?.title ?? '')
  const [points, setPoints] = useState(kept?.points ?? String(chore?.points ?? 10))
  const [steps, setSteps] = useState<string[]>(kept?.steps ?? chore?.steps.map((s) => s.title) ?? [])
  const [next, setNext] = useState(kept?.next ?? '')
  const [photo, setPhoto] = useState(kept?.photo ?? chore?.needs_photo ?? false)
  const pointsErr = intError(points, 0)
  const full = steps.length >= MAX_STEPS

  const addStep = () => {
    if (next.trim() && !full) setSteps([...steps, next.trim()])
    setNext('')
  }
  const discard = () => {
    setTitle(chore?.title ?? '')
    setPoints(String(chore?.points ?? 10))
    setSteps(chore?.steps.map((s) => s.title) ?? [])
    setNext('')
    setPhoto(chore?.needs_photo ?? false)
  }
  const move = (i: number, d: number) => {
    const s = [...steps]
    ;[s[i], s[i + d]] = [s[i + d], s[i]]
    setSteps(s)
  }

  const submit = () =>
    saveOnce(
      { id: chore?.id, body: { title: title.trim(), points: Number(points), needs_photo: photo, steps } },
      {
        onError: toastFail,
        onSuccess: (c) => {
          drafts.delete(key)
          toastOk(chore ? 'Saved' : 'Added. Now choose who does it.')
          if (!chore) onSelect(c.id)
        },
      },
    )

  const duplicate = () =>
    copyOnce(chore!.id, {
      onError: toastFail,
      onSuccess: (c) => {
        toastOk('Copied')
        onSelect(c.id)
      },
    })

  const dirty = !!next.trim() || (chore
    ? title.trim() !== chore.title ||
      !!pointsErr || Number(points) !== chore.points ||
      photo !== chore.needs_photo ||
      steps.join('\n') !== chore.steps.map((s) => s.title).join('\n')
    : !!(title.trim() || steps.length))

  // Switching tabs or chores unmounts this editor: keep what was typed so it isn't lost silently.
  useEffect(() => {
    if (dirty) drafts.set(key, { title, points, steps, next, photo })
    else drafts.delete(key)
  }, [dirty, key, title, points, steps, next, photo])
  useEffect(() => {
    if (!dirty) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  const when = chore ? schedules(chore).join(' + ') : ''

  return (
    <div className="pk-detail">
      <header className="pk-head">
        <span className="pk-tile pk-tile-lg">
          <Icon name={choreIcon(title)} size={30} />
        </span>
        <div className="pk-head-t">
          <h2>{title.trim() || 'New chore'}</h2>
          <div className="pk-chips">
            <Chip tone="acc" icon="stars">
              {pointsErr ? 0 : Number(points)} pts
            </Chip>
            {when && (
              <Chip tone="grey" icon="calendar_month">
                {when}
              </Chip>
            )}
            {photo && (
              <Chip tone="grey" icon="photo_camera">
                Needs photo
              </Chip>
            )}
          </div>
        </div>
        {chore && (
          <div className="pk-actions">
            <button type="button" className="p-btn" data-variant="red" onClick={open}>
              <Icon name="delete" />
              Delete
            </button>
            <button type="button" className="p-btn" onClick={duplicate} disabled={copy.isPending} aria-busy={copy.isPending}>
              <Icon name="content_copy" />
              {copy.isPending ? 'Duplicating…' : 'Duplicate'}
            </button>
            <ConfirmDelete
              opened={confirm}
              title={`Delete ${chore.title}?`}
              body="Chores already done stay in history."
              onConfirm={() => delOnce(chore.id, { onError: toastFail, onSuccess: () => onSelect(null) })}
              onClose={close}
            />
          </div>
        )}
      </header>

      <div className="pk-grid">
        <section className="pk-panel" aria-label="Basics">
          <h3>
            <Icon name="edit" size={18} />
            Basics
          </h3>
          <label className="pk-field">
            <span className="pk-label">Chore</span>
            <input className="pk-input" value={title} maxLength={100} onChange={(e) => setTitle(e.currentTarget.value)} />
          </label>
          <label className="pk-field">
            <span className="pk-label">Points</span>
            <input
              className="pk-input"
              inputMode="numeric"
              aria-label="Points"
              value={points}
              aria-invalid={!!pointsErr}
              aria-describedby={pointsErr ? 'chore-pts-err' : undefined}
              onChange={(e) => setPoints(e.currentTarget.value)}
            />
            {pointsErr && <span id="chore-pts-err" className="pk-error">{pointsErr}</span>}
          </label>
          <div className="pk-switch">
            <span id="photo-label">Needs a photo</span>
            <button type="button" role="switch" aria-checked={photo} aria-labelledby="photo-label" onClick={() => setPhoto(!photo)} />
          </div>
        </section>

        <section className="pk-panel" aria-label="Steps">
          <h3>
            <Icon name="checklist" size={18} />
            Steps
          </h3>
          {steps.map((s, i) => (
            <div key={`${i}-${s}`} className="pk-step">
              <span>{s}</span>
              <button type="button" className="pk-ib" disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Move up ${s}`} title="Move up">
                <Icon name="arrow_upward" size={16} />
              </button>
              <button type="button" className="pk-ib" disabled={i === steps.length - 1} onClick={() => move(i, 1)} aria-label={`Move down ${s}`} title="Move down">
                <Icon name="arrow_downward" size={16} />
              </button>
              <button type="button" className="pk-ib" onClick={() => setSteps(steps.filter((_, j) => j !== i))} aria-label={`Remove ${s}`} title="Remove step">
                <Icon name="close" size={16} />
              </button>
            </div>
          ))}
          <div className="pk-add">
            <input
              className="pk-input"
              aria-label="Add a step"
              placeholder={full ? `${MAX_STEPS} steps is the most` : 'Add a step'}
              value={next}
              maxLength={100}
              disabled={full}
              onChange={(e) => setNext(e.currentTarget.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addStep())}
            />
            <button type="button" className="p-btn" onClick={addStep} disabled={!next.trim() || full}>
              <Icon name="add" />
              Add step
            </button>
          </div>
          <span className="pk-hint">
            Every step must be ticked before the chore goes to you for approval. {steps.length} of {MAX_STEPS} steps.
          </span>
        </section>

        {chore ? (
          <WhoWhen chore={chore} kids={kids} />
        ) : (
          <section className="pk-panel pk-span" aria-label="Who and when">
            <h3>
              <Icon name="group" size={18} />
              Who & when
            </h3>
            <p className="pk-hint">Save the chore first, then choose who does it and when.</p>
          </section>
        )}
      </div>

      <div className="pk-foot">
        {dirty && (
          <span className="pk-dirty" role="status">
            <Icon name="edit_note" size={16} />
            {restored ? 'Unsaved changes (restored)' : 'Unsaved changes'}
          </span>
        )}
        {dirty && (
          <button type="button" className="p-btn" onClick={discard}>
            Discard
          </button>
        )}
        {!chore && (
          <button type="button" className="p-btn" onClick={() => (drafts.delete(key), onSelect(null))}>
            Cancel
          </button>
        )}
        <button type="button" className="p-btn" data-variant="accent" onClick={submit} disabled={!title.trim() || !!pointsErr || save.isPending} aria-busy={save.isPending}>
          <Icon name={save.isPending ? 'progress_activity' : 'check'} className={save.isPending ? 'pk-spin' : ''} />
          {save.isPending ? 'Saving…' : 'Save chore'}
        </button>
      </div>
    </div>
  )
}
