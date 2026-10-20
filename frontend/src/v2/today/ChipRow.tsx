import { useState } from 'react'
import { ChoreChip } from '../components/ChoreChip'
import { DevicePill, deviceKind } from '../components/DevicePill'
import { collapseRow } from '../collapse'
import type { TodayChore, TodayDevice } from '../types'
import { DeviceQuickMenu } from './DeviceQuickMenu'

/** Chore squares then device pills; collapses to a summary when crowded, tap to expand. */
export function ChipRow({ chores, devices }: { chores: TodayChore[]; devices: TodayDevice[] }) {
  const [open, setOpen] = useState(false)
  const done = chores.filter((c) => c.state === 'done').length
  const { collapsed, summary } = collapseRow(done, chores.length, devices.length)

  if (collapsed && !open) {
    return (
      <div className="f-row">
        <button type="button" className="f-pill" style={{ minHeight: 44 }} onClick={() => setOpen(true)}>
          {summary}
        </button>
      </div>
    )
  }
  return (
    <div className="f-row">
      {chores.map((c) => (
        <ChoreChip key={c.id} state={c.state} />
      ))}
      {devices.map((d) => (
        <DeviceQuickMenu key={d.id} targets={{ kind: 'device', id: d.id }} label={`${d.name} lock options`}>
          <DevicePill name={d.name} kind={deviceKind(d.name, d.vendor)} online={d.online} onClick={() => undefined} />
        </DeviceQuickMenu>
      ))}
      {collapsed && (
        <button type="button" className="f-pill" style={{ minHeight: 44 }} onClick={() => setOpen(false)}>
          Show less
        </button>
      )}
    </div>
  )
}
