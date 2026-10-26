import { useEffect, useState } from 'react'
import { Icon } from '@/v2/parent/Icon'
import type { KidChore, KidToday } from '../../types'
import { DeductionCards, NoteSent, PhotoButton, SentBackCard, isReady, whyNot } from '../ChoreParts'
import { KidChip, PointsChip } from '../KidChip'
import { kidChips, kidSort, tally } from '../kidChips'
import { KidSteps } from '../KidSteps'
import { TellParentSheet } from '../TellParent'
import { glyph } from './ChoreTile'
import type { ModeProps } from './types'

function Top({ d, name, avatar }: { d: KidToday; name: string; avatar: string | null }) {
  const t = tally(d.chores)
  return (
    <div className="l-top">
      <span className="l-me" aria-hidden>
        {avatar || '🙂'}
      </span>
      <h1 className="l-hi k-disp">{`Hi ${name}!`}</h1>
      <span className="l-wifi" data-on={!d.locked || undefined}>
        <Icon name={d.locked ? 'wifi_off' : 'wifi'} fill />
        {d.locked ? 'No games yet' : 'Games on!'}
      </span>
      {t.total > 0 && (
        <span className="l-stars" role="img" aria-label={`${t.approved} of ${t.total} done`}>
          {Array.from({ length: t.total }, (_, i) => (
            <i key={i} data-ok={i < t.approved || undefined}>
              <Icon name="star" fill />
            </i>
          ))}
        </span>
      )}
    </div>
  )
}

/** The "Do this now" card for one chore (09 .now). */
function Now({ c, d, now, onDone, busyId }: { c: KidChore; d: KidToday; now: number; onDone: (id: number) => void; busyId: number | null }) {
  const [tell, setTell] = useState(false)
  const ready = isReady(c)
  const chip = kidChips(c, now, d.timezone, true)[0]
  return (
    <>
      <span className="l-pic">
        <Icon name={glyph(c)} />
      </span>
      <h2 className="k-disp">{c.title}</h2>
      <div className="l-row">
        {chip && <KidChip chip={chip} size="lg" />}
        <PointsChip points={c.points} size="lg" />
      </div>
      {!!(c.note || c.last_note || c.deductions?.length) && (
        <div className="k-cards l-cards">
          <NoteSent c={c} />
          <SentBackCard c={c} />
          <DeductionCards c={c} />
        </div>
      )}
      {(c.subtasks?.length ?? 0) > 0 && (
        <div className="k-steps-card l-steps">
          <KidSteps c={c} timezone={d.timezone} size="big" />
        </div>
      )}
      {c.needs_photo && <PhotoButton c={c} />}
      <div className="l-row l-acts">
        <button type="button" className="l-did" disabled={!ready || busyId === c.id} onClick={() => onDone(c.id)}>
          <Icon name="check_circle" />
          I did it!
        </button>
        {!!c.notes?.length && (
          <button type="button" className="l-help" aria-label="Tell Mom or Dad" onClick={() => setTell(true)}>
            <Icon name="front_hand" />
          </button>
        )}
      </div>
      {!ready && <p className="k-hint">{whyNot(c)}</p>}
      {!!c.notes?.length && <TellParentSheet c={c} opened={tell} onClose={() => setTell(false)} />}
    </>
  )
}

function Row({ c, now, tz }: { c: KidChore; now: number; tz?: string }) {
  const chip = kidChips(c, now, tz, true)[0]
  const tone = chip?.tone === 'late' || chip?.tone === 'done' ? chip.tone : undefined
  return (
    <div className="l-q" data-tone={tone}>
      <span className="l-qi">
        <Icon name={tone === 'done' ? 'check' : glyph(c)} />
      </span>
      <div>
        <b>{c.title}</b>
        {chip && (
          <small>
            {tone !== 'done' && <Icon name={chip.icon} />}
            {chip.label}
          </small>
        )}
      </div>
    </div>
  )
}

/** Little (5–8) mode content (mockup 09): one big "Do this now" card + the Next queue. No chat. */
export function LittleMode({ d, name, avatar, now, onDone, busyId, onSeen }: ModeProps) {
  const list = kidSort(d.chores, now)
  const cur = list.find((c) => c.state === 'todo' && !c.taken_by)
  const rest = list.filter((c) => c !== cur)
  const curId = cur?.id
  const curNew = cur?.new
  useEffect(() => {
    if (curId !== undefined && curNew) onSeen(curId)
    // only when the shown chore changes, not when the parent re-creates onSeen
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [curId, curNew])
  const waiting = list.some((c) => c.state === 'needs_you')
  return (
    <section className="l-view">
      <Top d={d} name={name} avatar={avatar} />
      <div className="l-stage">
        <div className="l-now">
          {cur ? (
            <>
              <div className="l-label">Do this now</div>
              <Now key={cur.id} c={cur} d={d} now={now} onDone={onDone} busyId={busyId} />
            </>
          ) : (
            <>
              <span className="l-pic" data-tone={waiting ? 'wait' : 'done'}>
                <Icon name={waiting ? 'hourglass_top' : 'celebration'} />
              </span>
              <h2 className="k-disp">{waiting ? 'Waiting for Mom or Dad' : 'All done for today!'}</h2>
            </>
          )}
        </div>
        {rest.length > 0 && (
          <div className="l-queue">
            <div className="l-label">Next</div>
            {rest.map((c) => (
              <Row key={c.id} c={c} now={now} tz={d.timezone} />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
