import { Modal } from '@mantine/core'
import { useProfile } from '../hooks/useCommunity'
import { NameCard } from '../flair/NameCard'
import { NO_FLAIR } from '../flair/none'
import { useEmblems } from '../hooks/useEmblems'
import { BadgeGrid } from './BadgeGrid'

/** A sibling's name, level, streak and badges. Never balance or chores. */
export function ProfileModal({ kidId, kid = false, onClose }: { kidId: number | null; kid?: boolean; onClose: () => void }) {
  const p = useProfile(kidId, kid).data
  const emblems = useEmblems(kid)
  return (
    <Modal opened={kidId !== null} onClose={onClose} title={p ? p.name : 'Profile'} centered>
      {p ? (
        <div style={{ display: 'grid', gap: 12 }}>
          <NameCard name={p.name} avatar={p.avatar} level={p.level} title={p.title} flair={p.flair ?? NO_FLAIR} emblems={emblems} size="lg">
            <span className="f-cap">{`${p.streak} day streak`}</span>
          </NameCard>
          <BadgeGrid badges={p.badges} />
        </div>
      ) : (
        <p className="f-cap">Loading…</p>
      )}
    </Modal>
  )
}
