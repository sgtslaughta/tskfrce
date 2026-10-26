import { useEffect, useState } from 'react'
import { Switch, TextInput } from '@mantine/core'
import { TimeInput } from '@mantine/dates'
import { useNotifySettings, usePatchNotifySettings, usePlaces, type NotifySettings, type SettingsPatch } from '@/v2/hooks/useNotify'
import { Icon } from '@/v2/parent/Icon'
import { EmptyState, ErrorPanel, Skeleton } from '@/v2/parent/states'
import { toastFail } from '@/v2/notify'
import { PlaceCard } from './PlaceCard'
import { PlaceForm } from './PlaceForm'

const QUIET = { quiet_start: '21:30', quiet_end: '07:00' }

/** Saves a text field when it loses focus, if it changed. */
function useBlurField(saved: string, save: (v: string) => void) {
  const [v, setV] = useState(saved)
  useEffect(() => setV(saved), [saved])
  return { value: v, onChange: (e: React.ChangeEvent<HTMLInputElement>) => setV(e.currentTarget.value), onBlur: () => v !== saved && save(v) }
}

function QuietCard({ s, save }: { s: NotifySettings; save: (p: SettingsPatch) => void }) {
  const on = s.quiet_start !== null && s.quiet_end !== null
  const from = useBlurField(s.quiet_start ?? '', (v) => v && save({ quiet_start: v }))
  const to = useBlurField(s.quiet_end ?? '', (v) => v && save({ quiet_end: v }))
  return (
    <section className="pn-card" aria-label="Quiet hours">
      <h3 className="pn-h">
        <Icon name="bedtime" size={18} />
        <span className="pn-name">Quiet hours</span>
      </h3>
      <div className="pn-kv">
        <Switch
          className="pn-sw"
          label="Quiet hours"
          labelPosition="left"
          checked={on}
          onChange={(e) => save(e.currentTarget.checked ? QUIET : { quiet_start: null, quiet_end: null })}
        />
      </div>
      {on && (
        <div className="pn-times">
          <TimeInput label="From" {...from} />
          <TimeInput label="To" {...to} />
        </div>
      )}
      <div className="pn-kv">
        <Switch
          className="pn-sw"
          label="Security alerts still send"
          labelPosition="left"
          checked={s.quiet_security}
          onChange={(e) => save({ quiet_security: e.currentTarget.checked })}
        />
      </div>
    </section>
  )
}

function AddressCard({ s, save }: { s: NotifySettings; save: (p: SettingsPatch) => void }) {
  const field = useBlurField(s.app_address ?? '', (v) => save({ app_address: v.trim() || null }))
  return (
    <section className="pn-card" aria-label="App address">
      <h3 className="pn-h">
        <Icon name="link" size={18} />
        <span className="pn-name">App address</span>
      </h3>
      <p className="pn-help">Used for the link in each ping.</p>
      <TextInput
        aria-label="App address"
        className="pn-addr"
        placeholder={s.app_address_default ?? 'http://chores.local'}
        maxLength={200}
        {...field}
      />
    </section>
  )
}

export function NotificationsPane() {
  const places = usePlaces()
  const settings = useNotifySettings()
  const patch = usePatchNotifySettings()
  const [adding, setAdding] = useState(false)
  const save = (p: SettingsPatch) => patch.mutate(p, { onError: toastFail })
  const err = places.error ?? settings.error
  return (
    <div className="pn">
      <div className="pn-mh">
        <div>
          <h2>Notifications</h2>
          <div className="pn-s">Send t@sk4ce pings to the chat apps your family already uses.</div>
        </div>
        <button type="button" className="p-btn" data-variant="accent" onClick={() => setAdding(true)}>
          <Icon name="add" size={17} />
          Add a place
        </button>
      </div>
      {err && <ErrorPanel kind="unreachable" error={err} onRetry={() => (places.refetch(), settings.refetch())} />}
      {(places.isPending || settings.isPending) && !err && <Skeleton rows={2} />}
      {places.data?.length === 0 && (
        <EmptyState icon="notifications" title="No places yet" body="Add a Signal group, Discord channel, email or any Apprise address." />
      )}
      {settings.data && places.data?.map((p) => <PlaceCard key={p.id} place={p} events={settings.data.events} />)}
      {settings.data && (
        <div className="pn-g2">
          <QuietCard s={settings.data} save={save} />
          <AddressCard s={settings.data} save={save} />
        </div>
      )}
      <PlaceForm opened={adding} onClose={() => setAdding(false)} />
    </div>
  )
}
