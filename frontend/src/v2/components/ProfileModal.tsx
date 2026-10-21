import { Modal } from '@mantine/core'
import { useProfile } from '../hooks/useCommunity'
import { BadgeGrid } from './BadgeGrid'

/** A sibling's name, level, streak and badges. Never balance or chores. */
export function ProfileModal({ kidId, kid = false, onClose }: { kidId: number | null; kid?: boolean; onClose: () => void }) {
  const p = useProfile(kidId, kid).data
  return (
    <Modal opened={kidId !== null} onClose={onClose} title={p ? `${p.avatar ?? ''} ${p.name}` : 'Profile'} centered>
      {p ? (
        <div style={{ display: 'grid', gap: 12 }}>
          <div className="f-row">
            <span className="f-pill">{`Lv ${p.level} · ${p.title}`}</span>
            <span className="f-cap">{`${p.streak} day streak`}</span>
          </div>
          <BadgeGrid badges={p.badges} />
        </div>
      ) : (
        <p className="f-cap">Loading…</p>
      )}
    </Modal>
  )
}
