import { Button, Text } from '@mantine/core'
import { useChoreDefinitions, useChoresToday, useDeleteChore } from '@/v2/hooks/useChores'
import { ChoreEditor } from './ChoreEditor'
import { toastFail, toastOk } from '../notify'

/** Today's chores for one kid, their repeating chores, and the add form. */
export function ChoreList({ kidId }: { kidId: number }) {
  const today = useChoresToday()
  const stop = useDeleteChore()
  const defs = useChoreDefinitions(kidId).data ?? []
  const chores = today.data?.[String(kidId)] ?? []

  const stopOne = (id: number) =>
    stop.mutate(id, {
      onError: toastFail,
      onSuccess: () => toastOk('Stopped'),
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
      <ChoreEditor kidId={kidId} />
    </section>
  )
}
