import { useState } from 'react'
import { Button, CopyButton, NativeSelect, NumberInput, Switch, Text, TextInput } from '@mantine/core'
import { FridgeShell } from '@/v2/components/FridgeShell'
import { RequireParent } from '@/v2/components/RequireParent'
import { useGroups } from '@/v2/hooks/useDevices'
import { useFamily, useInvite, usePatchFamily } from '@/v2/hooks/useFamily'
import { useKids } from '@/v2/hooks/useKids'
import type { Family } from '@/v2/types'
import { toastFail, toastOk } from '../notify'
import { WindowEditor } from './WindowEditor'

function zones(current: string): string[] {
  const all = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.('timeZone') ?? []
  return all.includes(current) ? all : [current, ...all]
}

function Invite() {
  const invite = useInvite()
  const [username, setUsername] = useState('')
  const link = invite.data ? `${window.location.origin}/register?token=${invite.data.token}` : ''
  return (
    <section aria-label="Invite another parent">
      <h2 className="f-display">Invite another parent</h2>
      <TextInput label="Their username" value={username} onChange={(e) => setUsername(e.currentTarget.value)} />
      <Button
        disabled={username.trim().length < 3}
        loading={invite.isPending}
        onClick={() => invite.mutate(username.trim(), { onError: toastFail })}
      >
        Create invite link
      </Button>
      {link && (
        <div className="f-row">
          <TextInput aria-label="Invite link" readOnly value={link} style={{ flex: 1 }} />
          <CopyButton value={link}>
            {({ copied, copy }) => <Button onClick={copy}>{copied ? 'Copied' : 'Copy link'}</Button>}
          </CopyButton>
          <Text size="sm">The link works once and expires in 24 hours.</Text>
        </div>
      )}
    </section>
  )
}

function FamilyForm({ fam }: { fam: Family }) {
  const patch = usePatchFamily()
  const [draft, setDraft] = useState<Partial<Family>>({})
  const val = <K extends keyof Family>(k: K) => (k in draft ? draft[k] : fam[k]) as Family[K]
  const set = (p: Partial<Family>) => setDraft((d) => ({ ...d, ...p }))
  const changed = Object.fromEntries(
    Object.entries(draft).filter(([k, v]) => v !== fam[k as keyof Family]),
  ) as Partial<Family>

  return (
    <section aria-label="Family">
      <TextInput label="Family name" value={val('name')} onChange={(e) => set({ name: e.currentTarget.value })} />
      <NativeSelect
        label="Time zone"
        data={zones(fam.timezone)}
        value={val('timezone')}
        onChange={(e) => set({ timezone: e.currentTarget.value })}
      />
      <TextInput
        type="time"
        label="Reset time"
        description="Chores start fresh at this time."
        value={val('reset_time')}
        onChange={(e) => set({ reset_time: e.currentTarget.value })}
      />
      <Switch
        label="Block new devices until I assign them"
        checked={val('new_devices_blocked')}
        onChange={(e) => set({ new_devices_blocked: e.currentTarget.checked })}
      />
      <Switch
        label="Kids can spend points on screen time"
        checked={val('points_unlock_early')}
        onChange={(e) => set({ points_unlock_early: e.currentTarget.checked })}
      />
      <NumberInput
        label="Screen time price (points per 15 min)"
        min={1}
        max={1000}
        allowDecimal={false}
        value={val('screen_time_price')}
        onChange={(v) => typeof v === 'number' && set({ screen_time_price: v })}
      />
      <NumberInput
        label="Early finish bonus cap"
        min={0}
        max={50}
        allowDecimal={false}
        value={val('early_bonus_cap')}
        onChange={(v) => typeof v === 'number' && set({ early_bonus_cap: v })}
      />
      <Button
        disabled={Object.keys(changed).length === 0}
        loading={patch.isPending}
        onClick={() =>
          patch.mutate(changed, {
            onError: toastFail,
            onSuccess: () => {
              toastOk('Saved')
              setDraft({})
            },
          })
        }
      >
        Save settings
      </Button>
    </section>
  )
}

function SettingsBody() {
  const family = useFamily()
  const kids = useKids()
  const groups = useGroups()
  return (
    <FridgeShell title="Settings">
      {family.isError && <Text role="alert">{family.error.message}</Text>}
      {family.data && <FamilyForm fam={family.data} />}
      <h2 className="f-display">Hours</h2>
      {kids.data?.map((k) => (
        <WindowEditor key={`k${k.id}`} target={{ kid_id: k.id }} label={k.full_name ?? k.username} />
      ))}
      {groups.data?.map((g) => (
        <WindowEditor key={`g${g.id}`} target={{ group_id: g.id }} label={`Group: ${g.name}`} />
      ))}
      <Invite />
    </FridgeShell>
  )
}

export function SettingsPage() {
  return (
    <RequireParent>
      <SettingsBody />
    </RequireParent>
  )
}
