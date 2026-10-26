import { useState } from 'react'
import { useRouter } from 'next/router'
import { viewAs } from '@/v2/kid/viewAs'
import Link from 'next/link'
import { useDevices } from '@/v2/hooks/useDevices'
import { useLibrary } from '@/v2/hooks/useChores'
import { useToday } from '@/v2/hooks/useToday'
import { Chip } from '@/v2/parent/Chip'
import { Icon } from '@/v2/parent/Icon'
import { choreIcon } from '@/v2/today/choreIcon'
import type { Kid } from '@/v2/types'
import { AGE_LABEL } from './ageGroups'
import { KidEditor } from './KidEditor'
import { PointsForm } from './PointsForm'
import { initial, nameOf, schedules } from './choreMeta'

type Mode = 'bonus' | 'deduct' | 'edit'

interface Props {
  kid: Kid
  /** Open the editor with the PIN field focused (deep link from the PIN nudge). */
  focusPin?: boolean
  onDeleted: () => void
}

/** Kid header and actions, with Bonus / Deduct / Edit opening below; chores and devices from existing data. */
export function KidDetail({ kid, focusPin, onDeleted }: Props) {
  const { asPath } = useRouter()
  const [mode, setMode] = useState<Mode | null>(focusPin ? 'edit' : null)
  const t = useToday().data?.kids.find((k) => k.id === kid.id)
  const chores = (useLibrary().data ?? []).filter((c) => c.assignments.some((a) => a.active && a.kid_ids.includes(kid.id)))
  const devices = (useDevices().data ?? []).filter((d) => d.owner_ids.includes(kid.id))
  // closing an inline form hands focus back to the button that opened it
  const closeForm = (m: Mode) => {
    setMode(null)
    requestAnimationFrame(() => document.getElementById(`kid-act-${m}`)?.focus())
  }
  const toggle = (m: Mode) => setMode(mode === m ? null : m)
  const name = nameOf(kid)

  return (
    <div className="pk-detail">
      <header className="pk-head">
        <span className="pk-av" data-size="xl" aria-hidden="true">
          {initial(name)}
        </span>
        <div className="pk-head-t">
          <h2>{name}</h2>
          <div className="pk-chips">
            {t?.points !== undefined && (
              <Chip tone="acc" icon="stars">
                {t.points} pts
              </Chip>
            )}
            {t?.progress && (
              <Chip tone="grey" icon="trending_up">
                Level {t.progress.level}
              </Chip>
            )}
            <Chip tone={kid.has_pin ? 'grey' : 'lav'} icon={kid.has_pin ? 'lock' : 'lock_open'}>
              {kid.has_pin ? 'PIN set' : 'No PIN'}
            </Chip>
          </div>
        </div>
        <div className="pk-actions">
          <Link className="p-btn" href={viewAs(kid.id, asPath)}>
            <Icon name="visibility" />
            View as kid
          </Link>
          <button type="button" id="kid-act-bonus" className="p-btn" aria-pressed={mode === 'bonus'} onClick={() => toggle('bonus')}>
            <Icon name="add_circle" />
            Bonus
          </button>
          <button type="button" id="kid-act-deduct" className="p-btn" data-variant="red" aria-pressed={mode === 'deduct'} onClick={() => toggle('deduct')}>
            <Icon name="remove_circle" />
            Deduct
          </button>
          <button type="button" id="kid-act-edit" className="p-btn" data-variant="accent" aria-pressed={mode === 'edit'} onClick={() => toggle('edit')}>
            <Icon name="edit" />
            Edit
          </button>
        </div>
      </header>

      <div className="pk-grid">
        {(mode === 'bonus' || mode === 'deduct') && <PointsForm key={mode} kid={kid} kind={mode} onClose={() => closeForm(mode)} />}
        {mode === 'edit' && <KidEditor kid={kid} focusPin={focusPin} onDone={onDeleted} />}

        <section className="pk-panel" aria-label="Profile">
          <h3>
            <Icon name="badge" size={18} />
            Profile
          </h3>
          <div className="pk-kv"><span>Name</span><b>{name}</b></div>
          <div className="pk-kv"><span>Age group</span><b>{AGE_LABEL[kid.age_group]}</b></div>
          <div className="pk-kv"><span>PIN</span><b>{kid.has_pin ? '•••• set' : 'Not set'}</b></div>
          {t?.points !== undefined && <div className="pk-kv"><span>Points</span><b>{t.points}</b></div>}
          {t?.next_reward != null && <div className="pk-kv"><span>Next reward</span><b>{t.next_reward} pts away</b></div>}
        </section>

        <section className="pk-panel" aria-label="Devices">
          <h3>
            <Icon name="devices" size={18} />
            Devices
          </h3>
          {devices.length === 0 && <p className="pk-hint">No devices assigned yet.</p>}
          {devices.map((d) => (
            <div key={d.id} className="pk-line">
              <span className="pk-card-t">
                <b>{d.name}</b>
              </span>
              {d.online ? (
                <Chip tone="acc" icon="cloud_done">
                  Online
                </Chip>
              ) : (
                <Chip tone="grey" icon="cloud_off">
                  Offline
                </Chip>
              )}
            </div>
          ))}
        </section>

        <section className="pk-panel pk-span" aria-label="Chores assigned">
          <h3>
            <Icon name="task_alt" size={18} />
            Chores assigned
          </h3>
          {chores.length === 0 && <p className="pk-hint">No chores assigned yet.</p>}
          <div className="pk-tags">
            {chores.map((c) => (
              <span key={c.id} className="pk-tag">
                <Icon name={choreIcon(c.title)} size={16} />
                {[c.title, ...schedules(c, kid.id)].join(' · ')}
              </span>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
