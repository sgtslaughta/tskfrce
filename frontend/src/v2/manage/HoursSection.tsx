import { useState } from 'react'
import { Chip } from '@mantine/core'
import { useGroups } from '@/v2/hooks/useDevices'
import { useKids } from '@/v2/hooks/useKids'
import { WindowEditor } from './WindowEditor'

/** Kid (and group) filter chips; the selected one gets Allowed hours and Free time cards. */
export function HoursSection() {
  const kids = useKids().data ?? []
  const groups = useGroups().data ?? []
  const [sel, setSel] = useState<string | null>(null)
  const items = [
    ...kids.map((k) => ({ value: `k${k.id}`, label: k.full_name ?? k.username, target: { kid_id: k.id } })),
    ...groups.map((g) => ({ value: `g${g.id}`, label: `Group: ${g.name}`, target: { group_id: g.id } })),
  ]
  const cur = items.find((i) => i.value === sel) ?? items[0]
  return (
    <>
      <h2 className="f-display">Hours</h2>
      {items.length === 0 && <p className="m-empty">Add a kid first, then set when they can be online.</p>}
      <Chip.Group value={cur?.value ?? ''} onChange={(v) => setSel(String(v))}>
        <div className="f-row">
          {items.map((i) => (
            <Chip key={i.value} value={i.value}>
              {i.label}
            </Chip>
          ))}
        </div>
      </Chip.Group>
      {cur && <WindowEditor key={cur.value} target={cur.target} label={cur.label} />}
    </>
  )
}
