import { Chip } from '@mantine/core'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../api'
import type { Device, Kid } from '../types'

const GUEST = 'guest'

export function StepDevices({ kids }: { kids: Kid[] }) {
  const qc = useQueryClient()
  const list = useQuery({ queryKey: ['setup-devices'], queryFn: () => api<Device[]>('/devices'), refetchInterval: 5000 })
  const patch = useMutation({
    mutationFn: (v: { id: number; status: Device['status']; owner_ids: number[] }) =>
      api<Device>(`/devices/${v.id}`, { method: 'PATCH', body: { status: v.status, owner_ids: v.owner_ids } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['setup-devices'] }),
  })

  const change = (d: Device, vals: string[]) => {
    const wasGuest = d.status === 'guest'
    if (vals.includes(GUEST) && !wasGuest) return patch.mutate({ id: d.id, status: 'guest', owner_ids: [] })
    const ids = vals.filter((v) => v !== GUEST).map(Number)
    patch.mutate({ id: d.id, status: ids.length ? 'assigned' : 'unassigned', owner_ids: ids })
  }

  return (
    <>
      <p>Devices show up here once the box sees them on your Wi-Fi.</p>
      {list.data?.length === 0 && <p>No devices yet — you can add them later from Devices.</p>}
      {list.error && <p role="alert">Couldn&apos;t load devices. {list.error.message}</p>}
      {patch.error && <p role="alert">Couldn&apos;t save that. {patch.error.message}</p>}
      {list.data?.map((d) => {
        const value = d.status === 'guest' ? [GUEST] : d.owner_ids.map(String)
        return (
          <fieldset key={d.id} style={{ border: 0, padding: 0, margin: '0 0 12px' }}>
            <legend style={{ fontWeight: 700 }}>{d.name}</legend>
            <Chip.Group multiple value={value} onChange={(v) => change(d, v)}>
              <div className="f-row">
                {kids.map((k) => <Chip key={k.id} value={String(k.id)}>{k.avatar} {k.full_name}</Chip>)}
                <Chip value={GUEST}>Guest</Chip>
              </div>
            </Chip.Group>
          </fieldset>
        )
      })}
    </>
  )
}
