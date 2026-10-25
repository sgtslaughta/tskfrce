import { useState } from 'react'
import { Chip } from '@mantine/core'
import { useWindows } from '@/v2/hooks/useWindows'
import { useKids } from '@/v2/hooks/useKids'
import { useGroups } from '@/v2/hooks/useDevices'
import { HoursTimeline } from './HoursTimeline'
import { WindowEditor } from './WindowEditor'

export function HoursSection() {
  const allWindows = useWindows().data ?? []
  const kids = useKids().data ?? []
  const groups = useGroups().data ?? []
  const [sel, setSel] = useState<string | null>(null)

  const items = [
    ...kids.map((k) => ({ value: `k${k.id}`, label: k.full_name ?? k.username, kind: 'kid' as const, id: k.id })),
    ...groups.map((g) => ({ value: `g${g.id}`, label: `Group: ${g.name}`, kind: 'group' as const, id: g.id })),
  ]

  const cur = items.find((i) => i.value === sel) ?? items[0]

  const filteredWindows = cur ? (sel?.startsWith('k') ? allWindows.filter((w) => w.kid_id === parseInt(sel.slice(1))) : sel?.startsWith('g') ? allWindows.filter((w) => w.group_id === parseInt(sel.slice(1))) : allWindows.filter((w) => w.kid_id === cur.id)) : []

  const windowLabel = cur ? `${cur.label} hours` : 'Hours'

  return (
    <>
      <h2 className="f-display">Hours</h2>
      {items.length === 0 && <p className="m-empty">Add a kid first, then set when they can be online.</p>}
      <Chip.Group value={cur?.value ?? ''} onChange={(v) => setSel(String(v))}>
        <div className="f-row m-chips">
          {items.map((i) => (
            <Chip key={i.value} value={i.value}>
              <span className="m-chip-t">{i.label}</span>
            </Chip>
          ))}
        </div>
      </Chip.Group>
      {cur && (
        <section aria-label={windowLabel} role="region">
          <HoursTimeline windows={filteredWindows} kids={kids} groups={groups} />
          {cur.kind === 'kid' && cur.id && <WindowEditor target={{ kid_id: cur.id }} label={cur.label} />}
          {cur.kind === 'group' && cur.id && <WindowEditor target={{ group_id: cur.id }} label={cur.label} />}
        </section>
      )}
    </>
  )
}
