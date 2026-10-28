import { Icon } from '@/v2/parent/Icon'
import { STARTER_CHORES } from './starterChores'
import styles from './wizard.module.css'

interface Props {
  selected: string[]
  made?: string[] // already created: ticked, locked, "Added"
  hasKids: boolean
  onChange: (v: string[]) => void
}

/** Step 4 (mockup 07): starter cards with their chore type, points and a tick. */
export function StepChores({ selected, made = [], hasKids, onChange }: Props) {
  const toggle = (t: string) => onChange(selected.includes(t) ? selected.filter((x) => x !== t) : [...selected, t])
  return (
    <>
      {!hasKids && <p>You haven&apos;t added any kids yet, so there is nobody to give chores to. Go back to add one, or skip this.</p>}
      <div className={styles.starters} role="group" aria-label="Starter chores">
        {STARTER_CHORES.map((c) => {
          const added = made.includes(c.title)
          const on = added || selected.includes(c.title)
          return (
            <button key={c.title} type="button" className={styles.starter} aria-pressed={on} disabled={added} onClick={() => toggle(c.title)}>
              <span className={styles.starterTy}>
                <Icon name={c.glyph} size={17} />
              </span>
              <span className={styles.starterT}>
                {c.title}
                <small>{added ? 'Added' : `${c.type} · ${c.points} pts · daily`}</small>
              </span>
              <span className={styles.starterCb} aria-hidden="true">
                {on && <Icon name="check" size={15} />}
              </span>
            </button>
          )
        })}
      </div>
    </>
  )
}
