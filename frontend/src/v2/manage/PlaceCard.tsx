import { useState } from 'react'
import { Switch } from '@mantine/core'
import { useDeletePlace, usePatchPlace, useTestPlace, type NotifyEvent, type Place } from '@/v2/hooks/useNotify'
import { Icon } from '@/v2/parent/Icon'
import { toastFail, toastOk } from '@/v2/notify'
import { ConfirmDelete } from './ConfirmDelete'
import { PlaceForm } from './PlaceForm'

/** One Apprise place: on/off, masked address with a test button, and the events it gets. */
export function PlaceCard({ place, events }: { place: Place; events: NotifyEvent[] }) {
  const patch = usePatchPlace()
  const del = useDeletePlace()
  const test = useTestPlace()
  const [confirm, setConfirm] = useState(false)
  const [edit, setEdit] = useState(false)
  const set = (p: { enabled?: boolean; events?: string[] }) => patch.mutate({ id: place.id, ...p }, { onError: toastFail })
  const toggle = (key: string) =>
    set({ events: place.events.includes(key) ? place.events.filter((e) => e !== key) : [...place.events, key] })
  const runTest = () =>
    test.mutate(place.id, {
      onSuccess: (r) => (r.ok ? toastOk('Test sent') : toastFail(new Error(r.error ?? 'The test did not send.'))),
      onError: toastFail,
    })

  return (
    <section className="pn-card" aria-label={place.name}>
      <h3 className="pn-h">
        <Icon name="forum" size={18} />
        <span className="pn-name">{place.name}</span>
        <button type="button" className="p-btn pn-ib" aria-label={`Remove ${place.name}`} onClick={() => setConfirm(true)}>
          <Icon name="delete" size={17} />
        </button>
        <Switch
          className="pn-sw"
          aria-label={`Send to ${place.name}`}
          checked={place.enabled}
          onChange={(e) => set({ enabled: e.currentTarget.checked })}
        />
      </h3>
      {!place.readable && (
        <div className="pn-warn" role="alert">
          <Icon name="warning" size={18} />
          <span>Re-enter this address</span>
          <button type="button" className="p-btn" onClick={() => setEdit(true)}>
            Change address
          </button>
        </div>
      )}
      <div className="pn-inp">
        <Icon name="key" size={16} />
        <span className="pn-mask">{place.url_mask}</span>
        <button type="button" className="p-btn pn-test" onClick={runTest} disabled={test.isPending}>
          Test
        </button>
      </div>
      <div className="pn-evs">
        {events.map((ev) => (
          <button
            key={ev.key}
            type="button"
            className="pn-ev"
            aria-pressed={place.events.includes(ev.key)}
            disabled={patch.isPending}
            onClick={() => toggle(ev.key)}
          >
            {ev.label}
          </button>
        ))}
      </div>
      <ConfirmDelete
        opened={confirm}
        title="Remove this place?"
        body="t@sk4ce will stop sending pings there."
        confirmLabel="Remove"
        onConfirm={() => del.mutate(place.id, { onSuccess: () => toastOk('Removed'), onError: toastFail })}
        onClose={() => setConfirm(false)}
      />
      <PlaceForm opened={edit} onClose={() => setEdit(false)} place={place} />
    </section>
  )
}
