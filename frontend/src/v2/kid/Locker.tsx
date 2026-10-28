import { useEffect, useRef, useState } from 'react'
import { NameCard } from '../flair/NameCard'
import { useEquip, useFlair } from '../hooks/useFlair'
import { Icon } from '../parent/Icon'
import type { Flair, FlairSlot } from '../types'

const SLOTS: FlairSlot[] = ['card', 'ring', 'name', 'emblem', 'title']
const cap = (s: string) => s[0].toUpperCase() + s.slice(1)

interface Props {
  name: string
  avatar: string | null
  level: number
  title: string
  onClose: () => void
}

/** Kid customization (a Me sub-view in the kid shell): pick flair per slot, preview live, equip or remove. Styles: kid-locker.css. */
export function Locker({ name, avatar, level, title, onClose }: Props) {
  const flair = useFlair().data
  const equip = useEquip()
  const [slot, setSlot] = useState<FlairSlot>('card')
  const [picked, setPicked] = useState<Partial<Flair>>({})
  const h1 = useRef<HTMLHeadingElement>(null)
  useEffect(() => h1.current?.focus(), [])
  const back = (
    <button type="button" className="k-back" onClick={onClose}>
      <Icon name="arrow_back" />
      Back
    </button>
  )
  const head = <h1 ref={h1} tabIndex={-1} className="lk-h k-disp">Customize</h1>
  if (!flair)
    return (
      <section className="lk-view">
        {back}
        {head}
        <p className="k-hint">Loading…</p>
      </section>
    )
  const items = flair.items.filter((i) => i.slot === slot)
  const emblems = Object.fromEntries(flair.items.filter((i) => i.emblem).map((i) => [i.id, i.emblem as string]))
  const preview: Flair = { ...flair.equipped, ...picked }
  const sel = flair.items.find((i) => i.id === preview[slot])
  const choose = (id: string) => setPicked((p) => ({ ...p, [slot]: id }))
  const save = (id: string | null) =>
    equip.mutate({ slot, id }, { onSuccess: () => setPicked((p) => { const { [slot]: _, ...rest } = p; return rest }) })
  return (
    <section className="lk-view">
      {back}
      {head}
      <div className="me-card">
        <NameCard name={name} avatar={avatar} level={level} title={title} flair={preview} emblems={emblems} size="lg" />
        <div className="lk-slots" role="group" aria-label="What to change">
          {SLOTS.map((s) => (
            <button key={s} type="button" className="lk-slot" aria-pressed={s === slot} onClick={() => setSlot(s)}>
              {cap(s)}
            </button>
          ))}
        </div>
        <div className="lk-items">
          {items.map((i) => (
            <button key={i.id} type="button" className="lk-item" data-locked={!i.unlocked || undefined} aria-pressed={preview[slot] === i.id} onClick={() => choose(i.id)}>
              <span>{`${i.emblem ?? ''} ${i.name}`.trim()}</span>
              {!i.unlocked && (
                <small>
                  <Icon name="lock" />
                  {`Lv ${i.unlock_level}`}
                </small>
              )}
            </button>
          ))}
        </div>
        <div className="lk-acts">
          <button type="button" className="r-btn" disabled={!sel || !sel.unlocked || equip.isPending} onClick={() => save(sel!.id)}>
            Equip
          </button>
          <button type="button" className="r-btn" data-tone="plain" disabled={!flair.equipped[slot] || equip.isPending} onClick={() => save(null)}>
            Remove
          </button>
        </div>
      </div>
    </section>
  )
}
