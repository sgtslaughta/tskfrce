import { useState } from 'react'
import { Button, Checkbox, Chip, NativeSelect, NumberInput, TextInput } from '@mantine/core'
import { useCreateChore, type ChoreCreated, type Repeat } from '@/v2/hooks/useChores'
import { DAYS } from './WindowEditor'
import { toastFail, toastOk } from './notify'

const CHOICES = ['Every day', 'Weekdays', 'Pick days', 'Just today'] as const

function repeatOf(choice: string, picked: string[]): Repeat {
  if (choice === 'Every day') return { type: 'daily', days: [] }
  if (choice === 'Weekdays') return { type: 'weekly', days: [0, 1, 2, 3, 4] }
  if (choice === 'Pick days') return { type: 'weekly', days: picked.map(Number).sort() }
  return { type: 'once', days: [] }
}

export function ChoreEditor({ kidId, onCreated }: { kidId: number; onCreated?: (c: ChoreCreated) => void }) {
  const create = useCreateChore()
  const [title, setTitle] = useState('')
  const [points, setPoints] = useState<number | string>(10)
  const [choice, setChoice] = useState<string>('Every day')
  const [picked, setPicked] = useState<string[]>([])
  const [photo, setPhoto] = useState(false)

  const ready = title.trim() && (choice !== 'Pick days' || picked.length > 0)

  const submit = () =>
    create.mutate(
      {
        title: title.trim(),
        kid_id: kidId,
        points: Number(points) || 0,
        repeat: repeatOf(choice, picked),
        needs_photo: photo,
      },
      {
        onError: toastFail,
        onSuccess: (res) => {
          toastOk('Added')
          setTitle('')
          onCreated?.(res)
        },
      },
    )

  return (
    <div className="f-card">
      <TextInput label="Chore" value={title} onChange={(e) => setTitle(e.currentTarget.value)} />
      <NumberInput label="Points" min={0} value={points} onChange={setPoints} />
      <NativeSelect label="Repeat" data={[...CHOICES]} value={choice} onChange={(e) => setChoice(e.currentTarget.value)} />
      {choice === 'Pick days' && (
        <Chip.Group multiple value={picked} onChange={setPicked}>
          <div className="f-row">
            {DAYS.map((d, i) => (
              <Chip key={d} value={String(i)}>
                {d}
              </Chip>
            ))}
          </div>
        </Chip.Group>
      )}
      <Checkbox label="Needs a photo" checked={photo} onChange={(e) => setPhoto(e.currentTarget.checked)} />
      <Button onClick={submit} disabled={!ready} loading={create.isPending}>
        Add chore
      </Button>
    </div>
  )
}
