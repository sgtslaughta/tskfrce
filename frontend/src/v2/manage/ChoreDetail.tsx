import { useState } from 'react'
import { useDisclosure } from '@mantine/hooks'
import { useCopyChore, useDeleteChore, useSaveChore } from '@/v2/hooks/useChores'
import { Chip } from '@/v2/parent/Chip'
import { Icon } from '@/v2/parent/Icon'
import { choreIcon } from '@/v2/today/choreIcon'
import type { Kid, LibChore } from '@/v2/types'
import { ConfirmDelete } from './ConfirmDelete'
import { WhoWhen } from './WhoWhen'
import { schedules } from './choreMeta'
import { toastFail, toastOk } from '../notify'

interface Props {
  kids: Kid[]
  /** Omit to create a new chore. */
  chore?: LibChore
  /** Select a chore, or null to close the detail. */
  onSelect: (id: number | null) => void
}

/** Chore editor laid out as cards: header, Basics, Steps and Who & when. */
export function ChoreDetail({ kids, chore, onSelect }: Props) {
  const save = useSaveChore()
  const del = useDeleteChore()
  const copy = useCopyChore()
  const [confirm, { open, close }] = useDisclosure(false)
  const [title, setTitle] = useState(chore?.title ?? '')
  const [points, setPoints] = useState(String(chore?.points ?? 10))
  const [steps, setSteps] = useState<string[]>(chore?.steps.map((s) => s.title) ?? [])
  const [next, setNext] = useState('')
  const [photo, setPhoto] = useState(chore?.needs_photo ?? false)

  const addStep = () => {
    if (next.trim()) setSteps([...steps, next.trim()])
    setNext('')
  }
  const move = (i: number, d: number) => {
    const s = [...steps]
    ;[s[i], s[i + d]] = [s[i + d], s[i]]
    setSteps(s)
  }

  const submit = () =>
    save.mutate(
      { id: chore?.id, body: { title: title.trim(), points: Number(points) || 0, needs_photo: photo, steps } },
      {
        onError: toastFail,
        onSuccess: (c) => {
          toastOk(chore ? 'Saved' : 'Added. Now choose who does it.')
          if (!chore) onSelect(c.id)
        },
      },
    )

  const duplicate = () =>
    copy.mutate(chore!.id, {
      onError: toastFail,
      onSuccess: (c) => {
        toastOk('Copied')
        onSelect(c.id)
      },
    })

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
              {Number(points) || 0} pts
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
            <button type="button" className="p-btn" onClick={duplicate} disabled={copy.isPending}>
              <Icon name="content_copy" />
              Duplicate
            </button>
            <ConfirmDelete
              opened={confirm}
              title={`Delete ${chore.title}?`}
              body="Chores already done stay in history."
              onConfirm={() => del.mutate(chore.id, { onError: toastFail, onSuccess: () => onSelect(null) })}
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
            <input className="pk-input" value={title} onChange={(e) => setTitle(e.currentTarget.value)} />
          </label>
          <label className="pk-field">
            <span className="pk-label">Points</span>
            <input className="pk-input" type="number" min={0} value={points} onChange={(e) => setPoints(e.currentTarget.value)} />
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
              <button type="button" className="pk-ib" disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Move up ${s}`}>
                <Icon name="arrow_upward" size={16} />
              </button>
              <button type="button" className="pk-ib" disabled={i === steps.length - 1} onClick={() => move(i, 1)} aria-label={`Move down ${s}`}>
                <Icon name="arrow_downward" size={16} />
              </button>
              <button type="button" className="pk-ib" onClick={() => setSteps(steps.filter((_, j) => j !== i))} aria-label={`Remove ${s}`}>
                <Icon name="close" size={16} />
              </button>
            </div>
          ))}
          <div className="pk-add">
            <input
              className="pk-input"
              aria-label="Add a step"
              placeholder="Add a step"
              value={next}
              onChange={(e) => setNext(e.currentTarget.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addStep())}
            />
            <button type="button" className="p-btn" onClick={addStep} disabled={!next.trim()}>
              <Icon name="add" />
              Add step
            </button>
          </div>
          <span className="pk-hint">Every step must be ticked before the chore goes to you for approval.</span>
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
        {!chore && (
          <button type="button" className="p-btn" onClick={() => onSelect(null)}>
            Cancel
          </button>
        )}
        <button type="button" className="p-btn" data-variant="accent" onClick={submit} disabled={!title.trim() || save.isPending}>
          <Icon name="check" />
          Save chore
        </button>
      </div>
    </div>
  )
}
