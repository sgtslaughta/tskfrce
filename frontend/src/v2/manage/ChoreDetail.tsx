import { useCallback, useEffect, useRef, useState } from 'react'
import { useDisclosure } from '@mantine/hooks'
import { useCopyChore, useDeleteChore, useSaveAssignment, useSaveChore } from '@/v2/hooks/useChores'
import { useChoreTypes } from '@/v2/hooks/useChoreTypes'
import { HeaderChips } from '@/v2/parent/HeaderChips'
import { Icon } from '@/v2/parent/Icon'
import type { Kid, LibChore } from '@/v2/types'
import type { PendingAssignment } from './AssignmentForm'
import { ChoreSteps, type Step } from './ChoreSteps'
import { ChoreTypePanel } from './ChoreTypePanel'
import { ChoreTypePicker } from './ChoreTypePicker'
import { ConfirmDelete } from './ConfirmDelete'
import { useSingle } from './useSingle'
import { WhoWhen } from './WhoWhen'
import { intError, joinNames, nameOf, otherType, schedules, UNIVERSAL_NOTES, usedBy } from './choreMeta'
import { toastFail, toastOk } from '../notify'

interface Props {
  kids: Kid[]
  /** Omit to create a new chore. */
  chore?: LibChore
  /** Select a chore, or null to close the detail. */
  onSelect: (id: number | null) => void
}

interface Draft { title: string; points: string; typeId?: number; steps: Step[]; next: string; photo: boolean }
/** Unsaved edits per chore id ('new' for a chore not saved yet), kept while the editor is unmounted. */
const drafts = new Map<string, Draft>()
/** Forget all kept drafts (tests). */
export const clearChoreDrafts = () => drafts.clear()

const stepsOf = (c?: LibChore): Step[] =>
  c?.steps.map((s) => ({ title: s.title, due_time: s.due_time ?? null, after_previous: s.after_previous ?? false })) ?? []
const sameSteps = (a: Step[], b: Step[]) => JSON.stringify(a) === JSON.stringify(b)

/** Chore editor laid out as cards: header, Basics, Steps, Who & when and Notes. */
export function ChoreDetail({ kids, chore, onSelect }: Props) {
  const save = useSaveChore()
  const saveAssignment = useSaveAssignment()
  const [saving, setSaving] = useState(false)
  const busy = useRef(false)
  const del = useDeleteChore()
  const delOnce = useSingle(del)
  const copy = useCopyChore()
  const copyOnce = useSingle(copy)
  const [confirm, { open, close }] = useDisclosure(false)
  const types = useChoreTypes().data ?? []
  // 'new' = creating a type, a type id = editing it, null = panel closed
  const [panel, setPanel] = useState<'new' | number | null>(null)
  const key = String(chore?.id ?? 'new')
  const kept = drafts.get(key)
  const [restored] = useState(!!kept)
  const [title, setTitle] = useState(kept?.title ?? chore?.title ?? '')
  const [points, setPoints] = useState(kept?.points ?? String(chore?.points ?? 10))
  // picked type; unset = the chore's saved type (or Other for a new chore)
  const [picked, setPicked] = useState<number | undefined>(kept?.typeId)
  const [steps, setSteps] = useState<Step[]>(kept?.steps ?? stepsOf(chore))
  const [next, setNext] = useState(kept?.next ?? '')
  const [photo, setPhoto] = useState(kept?.photo ?? chore?.needs_photo ?? false)
  const pointsErr = intError(points, 0)
  // Who & when forms report their pending changes here so one Save sends everything
  const [pending, setPending] = useState<Record<string, PendingAssignment>>({})
  const report = useCallback(
    (k: string, p: PendingAssignment | null) =>
      setPending((cur) => {
        const { [k]: _old, ...rest } = cur
        return p ? { ...rest, [k]: p } : rest
      }),
    [],
  )
  const forms = Object.values(pending)
  const formsDirty = forms.some((f) => f.dirty)
  const formsBad = forms.some((f) => f.dirty && !f.ready)
  const [dueEdit, setDue] = useState<string>()
  const [gen, setGen] = useState(0) // remounts Who & when on Discard
  const savedDue = chore?.assignments.map((a) => a.due_time?.slice(0, 5)).filter((t): t is string => !!t).sort().pop() ?? ''
  const due = dueEdit ?? savedDue
  const dueTimes = new Set(chore?.assignments.map((a) => a.due_time?.slice(0, 5)).filter(Boolean))
  const typeId = picked ?? chore?.type_id ?? otherType(types)?.id
  const type = types.find((t) => t.id === typeId)

  const discard = () => {
    setTitle(chore?.title ?? '')
    setPoints(String(chore?.points ?? 10))
    setPicked(undefined)
    setSteps(stepsOf(chore))
    setDue(undefined)
    setGen((g) => g + 1)
    setNext('')
    setPhoto(chore?.needs_photo ?? false)
  }

  // the first step has nothing above it to wait for
  const stepBody = steps
    .filter((s) => s.title.trim())
    .map((s, i) => ({ ...s, title: s.title.trim(), after_previous: i > 0 && s.after_previous }))
  const submit = async () => {
    if (busy.current) return
    busy.current = true
    setSaving(true)
    try {
      const c = await save.mutateAsync({
        id: chore?.id,
        body: { title: title.trim(), points: Number(points), needs_photo: photo, type_id: typeId, steps: stepBody },
      })
      for (const f of forms.filter((f) => f.dirty)) await saveAssignment.mutateAsync({ choreId: chore?.id ?? c.id, id: f.id, body: f.body })
      drafts.delete(key)
      setDue(undefined)
      toastOk(chore ? 'Saved' : 'Added. Now choose who does it.')
      if (!chore) onSelect(c.id)
    } catch (e) {
      toastFail(e)
    } finally {
      busy.current = false
      setSaving(false)
    }
  }

  const duplicate = () =>
    copyOnce(chore!.id, {
      onError: toastFail,
      onSuccess: (c) => {
        toastOk('Copied')
        onSelect(c.id)
      },
    })

  const dirty = !!next.trim() || formsDirty || (chore
    ? title.trim() !== chore.title ||
      !!pointsErr || Number(points) !== chore.points ||
      photo !== chore.needs_photo ||
      (picked !== undefined && picked !== chore.type_id) ||
      !sameSteps(steps, stepsOf(chore))
    : !!(title.trim() || steps.length || picked !== undefined))

  // Switching tabs or chores unmounts this editor: keep what was typed so it isn't lost silently.
  useEffect(() => {
    if (dirty) drafts.set(key, { title, points, typeId: picked, steps, next, photo })
    else drafts.delete(key)
  }, [dirty, key, title, points, picked, steps, next, photo])
  useEffect(() => {
    if (!dirty) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  const when = chore ? schedules(chore).join(' + ') : ''
  const byId = new Map(kids.map((k) => [k.id, k]))
  const doers = joinNames((chore ? usedBy(chore) : []).flatMap((id) => (byId.has(id) ? [nameOf(byId.get(id)!)] : [])))

  return (
    <div className="pk-detail">
      <header className="pk-head">
        <span className="pk-tile pk-tile-lg">
          <Icon name={type?.glyph ?? 'task_alt'} size={30} />
        </span>
        <div className="pk-head-t">
          <h2>{title.trim() || 'New chore'}</h2>
          <HeaderChips
            items={[
              type && { icon: 'category', text: type.name },
              { icon: 'stars', text: `${pointsErr ? 0 : Number(points)} pts`, tone: 'acc' as const },
              when && { icon: 'event_repeat', text: when },
              photo && { icon: 'photo_camera', text: 'Needs photo' },
            ].filter((c) => !!c)}
          />
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
              onConfirm={() => delOnce(chore.id, { onError: toastFail, onSuccess: () => (toastOk('Deleted'), onSelect(null)) })}
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
            <span className="pk-label">Chore name</span>
            <input className="pk-input" value={title} maxLength={100} onChange={(e) => setTitle(e.currentTarget.value)} />
          </label>
          <ChoreTypePicker types={types} value={typeId} onPick={setPicked} onEdit={() => setPanel(typeId ?? null)} onNew={() => setPanel('new')} />
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
          <div>
          <label className="pk-field">
            <span className="pk-label">Due by (optional)</span>
            <input
              className="pk-input"
              type="time"
              value={due}
              disabled={!chore}
              aria-describedby={chore ? undefined : 'chore-due-hint'}
              onChange={(e) => setDue(e.currentTarget.value)}
            />
            {!chore && <span id="chore-due-hint" className="pk-hint">Set after you choose who does it.</span>}
          </label>
          {dueEdit === undefined && dueTimes.size > 1 && (
            <span className="pk-hint">Kids have different times — saving changes all</span>
          )}
          </div>
          <div className="pk-switch">
            <span id="photo-label">Needs a photo</span>
            <button type="button" role="switch" aria-checked={photo} aria-labelledby="photo-label" onClick={() => setPhoto(!photo)} />
          </div>
        </section>

        <ChoreSteps steps={steps} onChange={setSteps} next={next} onNext={setNext} choreDue={due || null} />

        {chore ? (
          <WhoWhen key={gen} chore={chore} kids={kids} due={due} dueTouched={dueEdit !== undefined} report={report} />
        ) : (
          <section className="pk-panel" aria-label="Who and when">
            <h3>
              <Icon name="group" size={18} />
              Who & when
            </h3>
            <p className="pk-hint">Save the chore first, then choose who does it and when.</p>
          </section>
        )}

        <section className="pk-panel" aria-label="Notes">
          <h3>
            <Icon name="sms" size={18} />
            Notes {doers || 'a kid'} can send
          </h3>
          {type && <p className="pk-hint">From the {type.name} type.</p>}
          <div className="pk-notes">
            {type?.notes.map((n) => (
              <span key={n.id} className="pk-np">
                {n.label}
              </span>
            ))}
            {UNIVERSAL_NOTES.map((n) => (
              <span key={n.label} className="pk-np" data-universal>
                {n.label}
              </span>
            ))}
          </div>
        </section>
      </div>

      <ChoreTypePanel
        opened={panel !== null}
        type={typeof panel === 'number' ? types.find((t) => t.id === panel) : undefined}
        onClose={() => setPanel(null)}
        onSaved={(t) => setPicked(t.id)}
        onDeleted={() => setPicked(undefined)}
      />

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
        <button type="button" className="p-btn" data-variant="accent" onClick={submit} disabled={!title.trim() || !!pointsErr || formsBad || saving} aria-busy={saving}>
          <Icon name={saving ? 'progress_activity' : 'check'} className={saving ? 'pk-spin' : ''} />
          {saving ? 'Saving…' : 'Save chore'}
        </button>
      </div>
    </div>
  )
}
