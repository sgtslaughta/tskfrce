import { Icon } from '@/v2/parent/Icon'
import type { ChoreType } from '@/v2/types'

interface Props {
  types: ChoreType[]
  value?: number
  onPick: (id: number) => void
  /** Edit the selected type in the side panel. */
  onEdit: () => void
  onNew: () => void
}

/** "Type" field: one chip per chore type (selected = accent, with a pencil), then a dashed "New type" chip. */
export function ChoreTypePicker({ types, value, onPick, onEdit, onNew }: Props) {
  return (
    <div className="pk-field">
      <span className="pk-label" id="chore-type-label">
        Type
      </span>
      <span className="pk-hint pk-hint-tight">Picks the icon and the notes a kid can send</span>
      <div className="pk-types" role="group" aria-labelledby="chore-type-label">
        {types.map((t) => {
          const on = t.id === value
          return (
            <span key={t.id} className="pk-type" data-on={on}>
              <button type="button" aria-pressed={on} onClick={() => onPick(t.id)}>
                <Icon name={t.glyph} size={16} />
                {t.name}
              </button>
              {on && (
                <button type="button" className="pk-type-edit" onClick={onEdit} aria-label={`Edit ${t.name} type`} title="Edit type">
                  <Icon name="edit" size={14} />
                </button>
              )}
            </span>
          )
        })}
        <span className="pk-type" data-new>
          <button type="button" onClick={onNew}>
            <Icon name="add" size={16} />
            New type
          </button>
        </span>
      </div>
    </div>
  )
}
