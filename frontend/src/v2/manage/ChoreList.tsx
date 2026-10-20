import { useState } from 'react'
import { Button, Text } from '@mantine/core'
import { useChoresToday, useDeleteChore } from '@/v2/hooks/useChores'
import type { Chore } from '@/v2/types'
import { ChoreEditor } from './ChoreEditor'
import { toastFail, toastOk } from './notify'

/**
 * Today's chores for one kid plus the add form.
 * The backend can't list repeating definitions, so "Stop repeating" is offered for the
 * ones added in this session (the create answer carries the definition id).
 */
export function ChoreList({ kidId }: { kidId: number }) {
  const today = useChoresToday()
  const stop = useDeleteChore()
  const [defs, setDefs] = useState<Chore[]>([])
  const chores = today.data?.[String(kidId)] ?? []

  const stopOne = (id: number) =>
    stop.mutate(id, {
      onError: toastFail,
      onSuccess: () => {
        toastOk('Stopped')
        setDefs((x) => x.filter((y) => y.id !== id))
      },
    })

  return (
    <section aria-label="Chores">
      <h3 className="f-display">Chores</h3>
      {chores.length === 0 && <Text>No chores today.</Text>}
      <ul>
        {chores.map((c) => (
          <li key={c.id}>
            {c.title} · {c.points} pts
          </li>
        ))}
      </ul>
      {defs.map((d) => (
        <div key={d.id} className="f-row">
          <Text>{d.title} repeats</Text>
          <Button variant="default" onClick={() => stopOne(d.id)}>
            Stop repeating
          </Button>
        </div>
      ))}
      <ChoreEditor kidId={kidId} onCreated={(r) => r.definition && setDefs((x) => [...x, r.definition as Chore])} />
    </section>
  )
}
