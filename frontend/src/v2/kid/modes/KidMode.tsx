import { useState } from 'react'
import { kidSort } from '../kidChips'
import { ChoreTile } from './ChoreTile'
import { ChoreView } from './ChoreView'
import { StatusBanner } from './StatusBanner'
import type { ModeProps } from './types'

/** Kid (9–12) mode content (mockup 10): status banner + tiles, or one chore at a time. */
export function KidMode({ d, name, now, onDone, busyId, onSeen, onChat, focusId }: ModeProps) {
  const [openId, setOpenId] = useState<number | null>(focusId ?? null)
  const open = d.chores.find((c) => c.id === openId)
  if (open)
    return (
      <section className="k-view">
        <ChoreView c={open} d={d} now={now} onBack={() => setOpenId(null)} onDone={onDone} busyId={busyId} onChat={onChat} />
      </section>
    )
  const list = kidSort(d.chores, now)
  return (
    <section className="k-view">
      <h1 className="k-hi k-disp">{`Hi ${name}!`}</h1>
      <StatusBanner d={d} size="big" />
      {list.length ? (
        <div className="k-tiles">
          {list.map((c) => (
            <ChoreTile
              key={c.id}
              c={c}
              now={now}
              tz={d.timezone}
              onOpen={() => {
                if (c.new) onSeen(c.id)
                setOpenId(c.id)
              }}
            />
          ))}
        </div>
      ) : (
        <p className="k-hint">No chores today. Enjoy the free time.</p>
      )}
    </section>
  )
}
