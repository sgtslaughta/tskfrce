import { Button } from '@mantine/core'
import { ProgressHeader } from '../components/ProgressHeader'
import { StickerCard } from '../components/StickerCard'
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
    <section className="k-view k-narrow">
      <h1 className="k-sr">{`${name} · Me`}</h1>
      {progress && (
        <StickerCard>
          <ProgressHeader name={name} avatar={avatar} kid progress={progress} />
          {!preview && (
            <Button variant="default" size="md" mt="xs" onClick={onLocker}>
              Customize
            </Button>
          )}
        </StickerCard>
      )}
      <FamilySection meId={kidId} />
      {canSwitch && (
        <Button variant="default" size="lg" onClick={onExit}>
          Not me
        </Button>
      )}
    </section>
  )
}
