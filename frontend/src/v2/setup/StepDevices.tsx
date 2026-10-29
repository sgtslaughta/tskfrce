import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../api'
import { Chip } from '../parent/Chip'
import { Icon } from '../parent/Icon'
import { MakerLogo } from '../parent/MakerLogo'
import { DEVICE_TYPE_ICON, getDeviceType } from '../manage/deviceMeta'
import { isPrivateMac } from '../manage/privateMac'
import type { Device, Kid } from '../types'
import styles from './devices.module.css'
import tip from './stepCards.module.css'

const GUEST = 'guest'

/** Step 5: discovery rows (type tile, name, maker, Private MAC chip) with an owner picker. */
export function StepDevices({ kids }: { kids: Kid[] }) {
  const qc = useQueryClient()
  const list = useQuery({ queryKey: ['setup-devices'], queryFn: () => api<Device[]>('/devices'), refetchInterval: 5000, refetchIntervalInBackground: false })
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

  const assigned = list.data?.filter((d) => d.status !== 'unassigned').length ?? 0
  return (
    <>
      {list.error && <p role="alert">Couldn&apos;t load devices. {list.error.message}</p>}
      {patch.error && <p role="alert">Couldn&apos;t save that. {patch.error.message}</p>}
      <div className={styles.card}>
        <div className={styles.head}>
          <span className={styles.pulse} aria-hidden="true" />
          <b>Looking for devices…{list.data ? ` ${list.data.length} found` : ''}</b>
          {list.data && list.data.length > 0 && <span>{assigned} of {list.data.length} assigned</span>}
        </div>
        {list.data?.map((d) => {
          const value = d.status === 'guest' ? [GUEST] : d.owner_ids.map(String)
          const toggle = (v: string) => change(d, value.includes(v) ? value.filter((x) => x !== v) : v === GUEST ? [GUEST] : [...value.filter((x) => x !== GUEST), v])
          const sub = [d.vendor || 'Unknown maker', d.ip].filter(Boolean).join(' · ')
          return (
            <div key={d.id} className={styles.dv} role="group" aria-label={`Owner of ${d.name}`}>
              <div className={styles.ic}>
                <Icon name={DEVICE_TYPE_ICON[getDeviceType(d.name, d.vendor)]} size={20} />
                {d.vendor && (
                  <span className={styles.vb}>
                    <MakerLogo vendor={d.vendor} size={11} />
                  </span>
                )}
              </div>
              <div className={styles.t2}>
                <b title={d.name}>{d.name}</b>
                <small>{sub}</small>
              </div>
              {isPrivateMac(d.mac) && (
                <Chip tone="amb" icon="wifi">
                  Private MAC
                </Chip>
              )}
              <div className={styles.who}>
                {kids.map((k) => (
                  <button
                    key={k.id}
                    type="button"
                    aria-pressed={value.includes(String(k.id))}
                    disabled={patch.isPending}
                    onClick={() => toggle(String(k.id))}
                  >
                    {k.avatar} {k.full_name}
                  </button>
                ))}
                <button type="button" className={styles.guest} aria-pressed={value.includes(GUEST)} disabled={patch.isPending} onClick={() => toggle(GUEST)}>
                  Guest
                </button>
              </div>
            </div>
          )
        })}
      </div>
      <div className={tip.tip}>
        <Icon name="info" size={20} />
        <div>
          <b>Not seeing a device?</b> Unlock it and open a web page so it talks to the network. iPhones and iPads: turn off “Private Wi-Fi Address” for your home Wi-Fi.
        </div>
      </div>
    </>
  )
}
