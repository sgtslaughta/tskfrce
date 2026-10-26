import { useState } from 'react'
import { useMediaQuery } from '@mantine/hooks'
import { Icon } from '@/v2/parent/Icon'
import type { KidChore, KidToday } from '../../types'
import { clock, kidSort, tally } from '../kidChips'
import { TeenDetail } from './TeenDetail'
import { TeenRow } from './TeenRow'
import type { ModeProps } from './types'

type Filter = 'all' | 'todo' | 'wait' | 'done'
const match: Record<Filter, (c: KidChore) => boolean> = {
  all: () => true,
  todo: (c) => c.state === 'todo',
  wait: (c) => c.state === 'needs_you',
  done: (c) => c.state === 'done',
}

function weekday(now: number, tz?: string) {
  try {
    return new Date(now).toLocaleDateString('en-US', { weekday: 'long', timeZone: tz })
  } catch {
    return new Date(now).toLocaleDateString('en-US', { weekday: 'long' })
  }
}

function Stat({ icon, tone, fill, title, sub }: { icon: string; tone: string; fill?: boolean; title: string; sub: string }) {
  return (
    <div className="t-sc">
      <span className="t-ic" data-tone={tone}>
        <Icon name={icon} fill={fill} />
      </span>
      <div>
        <b>{title}</b>
        <small>{sub}</small>
      </div>
    </div>
  )
}

function Stats({ d }: { d: KidToday }) {
  const t = tally(d.chores)
  const left = `${t.left} ${t.left === 1 ? 'chore' : 'chores'} left`
  const at = d.locks_at ? clock(d.locks_at, d.timezone) : null
  const streak = d.progress?.streak ?? 0
  return (
    <div className="t-strip">
      {d.locked ? (
        <Stat icon="lock" tone="coral" fill title="Internet paused" sub={at ? `${left} · night lock ${at}` : left} />
      ) : (
        <Stat icon="wifi" tone="green" fill title="Internet on" sub={at ? `locks at ${at}` : t.left ? left : 'All done'} />
      )}
      <Stat icon="task_alt" tone="green" title={`${t.approved} / ${t.total}`} sub="done today" />
      <Stat icon="star" tone="sun" fill title={String(d.points_balance)} sub="points" />
      <Stat icon="local_fire_department" tone="fire" fill title={`${streak} ${streak === 1 ? 'day' : 'days'}`} sub="streak" />
    </div>
  )
}

/** Teen (13+) mode content (mockup 11): stats strip, filters, list + detail. */
export function TeenMode({ d, name, now, onDone, busyId, onSeen, onChat }: ModeProps) {
  const wide = useMediaQuery('(min-width: 1100px)')
  const [filter, setFilter] = useState<Filter>('all')
  const [picked, setPicked] = useState<number | null>(null)
  const t = tally(d.chores)
  const list = kidSort(d.chores, now).filter(match[filter])
  const sel = d.chores.find((c) => c.id === picked) ?? (wide ? list[0] : undefined)
  const pick = (id: number) => {
    onSeen(id)
    setPicked(id)
  }
  const detail = (back?: () => void) =>
    sel && <TeenDetail c={sel} d={d} now={now} onBack={back} onDone={onDone} busyId={busyId} onChat={onChat} />
  if (!wide && sel) return <section className="t-view">{detail(() => setPicked(null))}</section>
  const pills: [Filter, string, number][] = [
    ['all', 'All', t.total],
    ['todo', 'To do', t.todo],
    ['wait', 'Waiting', t.waiting],
    ['done', 'Done', t.approved],
  ]
  return (
    <section className="t-view" data-wide={wide || undefined}>
      <div className="t-main">
        <div className="t-hd">
          <h1 className="k-disp">Today</h1>
          <span>{`${weekday(now, d.timezone)} · ${name}`}</span>
        </div>
        <Stats d={d} />
        <div className="t-filters">
          {pills.map(([f, label, n]) => (
            <button key={f} type="button" className="t-f" aria-pressed={filter === f} onClick={() => setFilter(f)}>
              {`${label} · ${n}`}
            </button>
          ))}
        </div>
        {list.length ? (
          <div className="t-list">
            {list.map((c) => (
              <TeenRow key={c.id} c={c} now={now} tz={d.timezone} selected={c.id === sel?.id} onSelect={() => pick(c.id)} />
            ))}
          </div>
        ) : (
          <p className="t-empty">{d.chores.length ? 'Nothing here.' : 'No chores today. Enjoy the free time.'}</p>
        )}
      </div>
      {wide && <aside className="t-aside">{detail()}</aside>}
    </section>
  )
}
