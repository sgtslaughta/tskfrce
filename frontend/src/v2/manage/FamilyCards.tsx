import { useState, type ReactNode } from 'react'
import { Button, NativeSelect, NumberInput, Switch, Text, TextInput } from '@mantine/core'
import { usePatchFamily } from '@/v2/hooks/useFamily'
import type { Family } from '@/v2/types'
import { toastFail, toastOk } from '../notify'

function zones(current: string): string[] {
  const all = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.('timeZone') ?? []
  return all.includes(current) ? all : [current, ...all]
}

interface Draft {
  val: <K extends keyof Family>(k: K) => Family[K]
  set: (p: Partial<Family>) => void
}

/** A settings card: only changed fields are PATCHed; Save is enabled once something differs. */
function Card({ title, fam, children }: { title: string; fam: Family; children: (d: Draft) => ReactNode }) {
  const patch = usePatchFamily()
  const [draft, setDraft] = useState<Partial<Family>>({})
  const val = <K extends keyof Family>(k: K) => (k in draft ? draft[k] : fam[k]) as Family[K]
  const set = (p: Partial<Family>) => setDraft((d) => ({ ...d, ...p }))
  const changed = Object.fromEntries(
    Object.entries(draft).filter(([k, v]) => v !== fam[k as keyof Family]),
  ) as Partial<Family>
  return (
    <section aria-label={title} className="f-card m-card">
      <h2 className="f-display">{title}</h2>
      <div className="m-form">
        {children({ val, set })}
        <div className="m-actions">
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
        </div>
      </div>
    </section>
  )
}

const Help = ({ children }: { children: string }) => <Text className="m-help">{children}</Text>

export function FamilyCard({ fam }: { fam: Family }) {
  return (
    <Card title="Family" fam={fam}>
      {({ val, set }) => (
        <>
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
          <Help>New phones and laptops stay paused until you give them an owner.</Help>
        </>
      )}
    </Card>
  )
}

export function ScreenTimeCard({ fam }: { fam: Family }) {
  return (
    <Card title="Screen time & bonuses" fam={fam}>
      {({ val, set }) => (
        <>
          <Switch
            label="Kids can spend points on screen time"
            checked={val('points_unlock_early')}
            onChange={(e) => set({ points_unlock_early: e.currentTarget.checked })}
          />
          <Help>Lets kids trade points for extra time outside their allowed hours.</Help>
          <NumberInput
            label="Screen time price (points per 15 min)"
            min={1}
            max={1000}
            allowDecimal={false}
            value={val('screen_time_price')}
            onChange={(v) => typeof v === 'number' && set({ screen_time_price: v })}
          />
          <Help>How many points 15 minutes of extra time costs.</Help>
          <NumberInput
            label="Early finish bonus cap"
            min={0}
            max={50}
            allowDecimal={false}
            value={val('early_bonus_cap')}
            onChange={(v) => typeof v === 'number' && set({ early_bonus_cap: v })}
          />
          <Help>The most bonus points a kid can earn for finishing chores early.</Help>
        </>
      )}
    </Card>
  )
}
