import { useState } from 'react'
import { Button, SegmentedControl } from '@mantine/core'
import { NameCard } from '../flair/NameCard'
import { StickerCard } from '../components/StickerCard'
import { useEquip, useFlair } from '../hooks/useFlair'
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

/** Kid customization: pick flair per slot, preview live, equip or remove. */
export function Locker({ name, avatar, level, title, onClose }: Props) {
  const flair = useFlair().data
  const equip = useEquip()
  const [slot, setSlot] = useState<FlairSlot>('card')
  const [picked, setPicked] = useState<Partial<Flair>>({})
  if (!flair) return <StickerCard><p style={{ margin: 0 }}>Loading…</p></StickerCard>
  const items = flair.items.filter((i) => i.slot === slot)
  const emblems = Object.fromEntries(flair.items.filter((i) => i.emblem).map((i) => [i.id, i.emblem as string]))
  const preview: Flair = { ...flair.equipped, ...picked }
  const sel = flair.items.find((i) => i.id === preview[slot])
  const choose = (id: string) => setPicked((p) => ({ ...p, [slot]: id }))
  const save = (id: string | null) =>
    equip.mutate({ slot, id }, { onSuccess: () => setPicked((p) => { const { [slot]: _, ...rest } = p; return rest }) })
  return (
    <StickerCard>
      <div style={{ display: 'grid', gap: 12 }}>
        <NameCard name={name} avatar={avatar} level={level} title={title} flair={preview} emblems={emblems} size="lg" />
        <SegmentedControl
          fullWidth
          value={slot}
          onChange={(v) => setSlot(v as FlairSlot)}
          data={SLOTS.map((s) => ({ value: s, label: cap(s) }))}
        />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))', gap: 8 }}>
          {items.map((i) => (
            <Button
              key={i.id}
              variant={preview[slot] === i.id ? 'filled' : 'default'}
              onClick={() => choose(i.id)}
              style={{ opacity: i.unlocked ? 1 : 0.5, height: 'auto', padding: 8 }}
            >
              <span style={{ display: 'grid', justifyItems: 'center' }}>
                <span>{i.emblem ?? ''} {i.name}</span>
                {!i.unlocked && <small>{`Lv ${i.unlock_level}`}</small>}
              </span>
            </Button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button size="lg" disabled={!sel || !sel.unlocked || equip.isPending} onClick={() => save(sel!.id)}>
            Equip
          </Button>
          <Button size="lg" variant="default" disabled={!flair.equipped[slot] || equip.isPending} onClick={() => save(null)}>
            Remove
          </Button>
          <Button size="lg" variant="subtle" onClick={onClose}>
            Back
          </Button>
        </div>
      </div>
    </StickerCard>
  )
}
