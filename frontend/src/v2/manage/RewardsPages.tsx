import { useState } from 'react'
import { Button } from '@mantine/core'
import type { PendingRedemption, Reward } from '@/v2/types'

interface Props {
  requests?: PendingRedemption[]
  rewards?: Reward[]
  onApproveRequest?: (requestId: number) => void
  onDeclineRequest?: (requestId: number) => void
  onNewReward?: () => void
}

type RewardsTab = 'requests' | 'catalogue' | 'screen-time' | 'history'

export function RewardsPages({
  requests = [],
  rewards = [],
  onApproveRequest,
  onDeclineRequest,
  onNewReward,
}: Props) {
  const [tab, setTab] = useState<RewardsTab>('requests')

  const shortBalance = (balance: number, cost: number) => balance < cost

  return (
    <div className="p-rewards-pages">
      <div className="s-tabs">
        {(['requests', 'catalogue', 'screen-time', 'history'] as const).map((t) => (
          <button
            key={t}
            className={`s-tab ${tab === t ? 's-tab-active' : ''}`}
            onClick={() => setTab(t)}
          >
            {t === 'requests' && `Requests · ${requests.length}`}
            {t === 'catalogue' && 'Catalogue'}
            {t === 'screen-time' && 'Screen time'}
            {t === 'history' && 'History'}
          </button>
        ))}
      </div>

      {tab === 'requests' && (
        <div className="p-requests">
          {requests.length === 0 && <p>No pending requests</p>}
          {requests.map((r) => (
            <div key={r.id} className="p-request-card">
              <div className="p-request-header">
                <div>
                  <div className="p-request-name">{r.name}</div>
                  <div className="p-request-kid">{r.kid_name}</div>
                </div>
                <div className="p-request-cost">{r.cost} points</div>
              </div>
              <div className="p-request-balance">
                <span>Balance: {r.kid_balance}</span>
                <span>{r.kid_balance - r.cost}</span>
              </div>
              {shortBalance(r.kid_balance, r.cost) && (
                <div className="p-error">Not enough points</div>
              )}
              <div className="p-request-actions">
                <Button
                  size="xs"
                  disabled={shortBalance(r.kid_balance, r.cost)}
                  onClick={() => onApproveRequest?.(r.id)}
                >
                  Approve
                </Button>
                <Button size="xs" variant="default" onClick={() => onDeclineRequest?.(r.id)}>
                  Decline
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'catalogue' && (
        <div className="p-catalogue">
          <Button size="sm" onClick={() => onNewReward?.()}>
            New reward
          </Button>
          {rewards.length === 0 && <p>No rewards in catalogue</p>}
          <div className="p-reward-grid">
            {rewards.map((r) => (
              <div key={r.id} className="p-reward-card">
                <div className="p-reward-icon">redeem</div>
                <div className="p-reward-name">{r.name}</div>
                <div className="p-reward-price">{r.price} points</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'screen-time' && (
        <div className="p-screen-time">
          <p>Screen time settings coming soon</p>
        </div>
      )}

      {tab === 'history' && (
        <div className="p-history">
          <p>Reward history coming soon</p>
        </div>
      )}
    </div>
  )
}
