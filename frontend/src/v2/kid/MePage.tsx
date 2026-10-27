import { Icon } from '../parent/Icon'
import { ProgressHeader } from '../components/ProgressHeader'
import type { Progress } from '../types'
import { FamilySection } from './FamilySection'

/** Kid "Me" tab: name card with XP, Customize (not in preview), family, and "Not me" on shared devices. */
export function MePage({
  name,
  avatar,
  progress,
  preview,
  onLocker,
  canSwitch,
  onExit,
  kidId,
}: {
  name: string
  avatar: string | null
  progress?: Progress
  preview: boolean
  onLocker: () => void
  canSwitch: boolean
  onExit: () => void
  kidId?: number | null
}) {
  return (
    <section className="me-view">
      <h1 className="k-sr">{`${name} · Me`}</h1>
      {progress && (
        <div className="me-card">
          <ProgressHeader name={name} avatar={avatar} kid progress={progress} />
          {!preview && (
            <button type="button" className="r-btn" onClick={onLocker}>
              <Icon name="palette" />
              Customize
            </button>
          )}
        </div>
      )}
      <FamilySection meId={kidId} />
      {canSwitch && (
        <button type="button" className="r-btn me-out" data-tone="plain" onClick={onExit}>
          <Icon name="swap_horiz" />
          Not me
        </button>
      )}
    </section>
  )
}
