import { Button } from '@mantine/core'
import type { Kid } from '@/v2/types'

interface Props {
  kid: Kid | undefined
  onViewAsKid: (kidId: number) => void
  onBonus: (kidId: number) => void
  onEdit: (kidId: number) => void
}

export function KidDetail({ kid, onViewAsKid, onBonus, onEdit }: Props) {
  if (!kid) return <div className="p-empty">Select a kid to see their details</div>

  return (
    <div className="p-kid-detail">
      <div className="p-kid-header">
        <div className="p-av-lg">{kid.avatar || kid.full_name?.[0] || 'K'}</div>
        <div>
          <h2>{kid.full_name || kid.username}</h2>
          <div className="p-kid-meta">No level data yet</div>
        </div>
      </div>

      <div className="p-kid-actions">
        <Button size="sm" onClick={() => onViewAsKid(kid.id)}>
          View as kid
        </Button>
        <Button size="sm" onClick={() => onBonus(kid.id)}>
          Bonus
        </Button>
        <Button size="sm" onClick={() => onEdit(kid.id)}>
          Edit
        </Button>
      </div>

      <div className="p-kid-cards">
        <div className="p-card">
          <h3>Profile</h3>
          <p>Profile data coming soon</p>
        </div>
        <div className="p-card">
          <h3>Devices</h3>
          <p>Device data coming soon</p>
        </div>
        <div className="p-card">
          <h3>Chores</h3>
          <p>Chore assignment data coming soon</p>
        </div>
        <div className="p-card">
          <h3>Points history</h3>
          <p>Points ledger coming soon</p>
        </div>
      </div>
    </div>
  )
}
