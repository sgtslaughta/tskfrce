import { Button } from '@mantine/core'
import { useDecideRedemption, usePendingRedemptions } from '@/v2/hooks/useRewards'
import { toastFail, toastOk } from '../notify'

/** Pending screen time and reward requests; hidden when there are none. */
export function RequestsPanel() {
  const { data } = usePendingRedemptions()
  const decide = useDecideRedemption()
  if (!data?.length) return null

  const act = (id: number, approve: boolean) =>
    decide.mutate({ id, approve }, { onError: toastFail, onSuccess: () => toastOk(approve ? 'Approved' : 'Denied') })

  return (
    <section className="f-card" aria-label="Requests">
      <h2 className="f-display f-card-head">Requests</h2>
      {data.map((r) => (
        <div key={r.id} className="f-row">
          <span style={{ flex: 1 }}>
            {`${r.kid_name ?? 'A kid'} wants ${r.name} (${r.cost})`}
            <span className="f-cap">{` Balance: ${r.kid_balance}`}</span>
          </span>
          <Button disabled={decide.isPending} onClick={() => act(r.id, true)}>
            Approve
          </Button>
          <Button variant="default" disabled={decide.isPending} onClick={() => act(r.id, false)}>
            Deny
          </Button>
        </div>
      ))}
    </section>
  )
}
