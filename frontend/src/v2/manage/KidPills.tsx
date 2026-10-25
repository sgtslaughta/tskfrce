import type { Kid } from '@/v2/types'
import { initial, nameOf } from './choreMeta'

interface Props {
  kids: Kid[]
  value: number[]
  onChange: (ids: number[]) => void
  disabled?: boolean
  label: string
}

/** Kid picker: pill toggles with letter avatars (same look as Kids & chores' Who & when). */
export function KidPills({ kids, value, onChange, disabled, label }: Props) {
  const toggle = (id: number) => onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id])
  return (
    <div className="pk-pills" role="group" aria-label={label}>
      {kids.map((k) => (
        <button key={k.id} type="button" className="pk-pill" aria-pressed={value.includes(k.id)} disabled={disabled} onClick={() => toggle(k.id)}>
          <span className="pk-av" aria-hidden="true">{initial(nameOf(k))}</span>
          {nameOf(k)}
        </button>
      ))}
    </div>
  )
}
