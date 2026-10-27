import { useEffect, useState } from 'react'
import { Chip } from '@/v2/parent/Chip'
import { Icon } from '@/v2/parent/Icon'
import type { Kid, LibChore } from '@/v2/types'
import { AssignmentForm, type PendingAssignment } from './AssignmentForm'

/** "Who & when" card: one form per assignment of the chore, plus a form to add another. */
export function WhoWhen({
  chore,
  kids,
  due,
  report,
}: {
  chore: LibChore
  kids: Kid[]
  due: string
  report: (key: string, p: PendingAssignment | null) => void
}) {
  const [adding, setAdding] = useState(false)
  useEffect(() => setAdding(false), [chore.assignments.length])
  const has = chore.assignments.length > 0
  return (
    <section className="pk-panel" aria-label="Who and when">
      <h3>
        <Icon name="group" size={18} />
        Who & when
      </h3>
      {!has && <p className="pk-hint">Nobody has this chore yet. Pick who does it and how often.</p>}
      {chore.assignments.map((a) => (
        <div key={a.id} className="pk-sub">
          {!a.active && (
            <Chip tone="grey" icon="pause_circle">
              Stopped
            </Chip>
          )}
          <AssignmentForm kids={kids} assignment={a} due={due} report={report} />
        </div>
      ))}
      {(adding || !has) && (
        <div className="pk-sub">
          <AssignmentForm key={chore.assignments.length} kids={kids} due={due} report={report} dismissable={has} onClose={() => setAdding(false)} />
        </div>
      )}
      {has && !adding && (
        <div className="pk-actions">
          <button type="button" className="p-btn" onClick={() => setAdding(true)}>
            <Icon name="add" />
            Add another assignment
          </button>
        </div>
      )}
    </section>
  )
}
