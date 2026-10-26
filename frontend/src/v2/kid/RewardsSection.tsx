import { useState } from 'react'
import { Button, NativeSelect, Progress } from '@mantine/core'
import { StickerCard } from '../components/StickerCard'
import { useKidRewards, useRedeem } from '../hooks/useKidRewards'

const MINUTES = [15, 30, 45, 60, 75, 90, 105, 120].map((m) => ({ value: String(m), label: `${m} minutes` }))

export function RewardsSection({ onExpired, heading = 'Rewards' }: { onExpired: () => void; heading?: string }) {
  const { data: d } = useKidRewards(onExpired)
  const redeem = useRedeem(onExpired)
  const [minutes, setMinutes] = useState('30')
  if (!d?.pending) return null
  const pendingReward = (id: number) => d.pending.some((p) => p.kind === 'reward' && p.reward_id === id)
  const pendingTime = d.pending.some((p) => p.kind === 'screen_time')
  const cost = (Number(minutes) / 15) * d.screen_time_price
  return (
    <StickerCard>
      <div style={{ display: 'grid', gap: 12 }}>
        <h2 style={{ margin: 0 }}>
          {heading} · <span className="f-num">{d.balance}</span> points
        </h2>
        {d.screen_time_enabled && (
          <div style={{ display: 'grid', gap: 8 }}>
            <NativeSelect
              label="Screen time"
              data={MINUTES}
              value={minutes}
              onChange={(e) => setMinutes(e.currentTarget.value)}
            />
            <p style={{ margin: 0 }}>
              Costs <span className="f-num">{cost}</span> points
            </p>
            {pendingTime ? (
              <span className="f-pill" data-tone="wait">Waiting for a parent</span>
            ) : (
              <Button
                disabled={cost > d.balance || redeem.isPending}
                onClick={() => redeem.mutate({ kind: 'screen_time', minutes: Number(minutes) })}
              >
                Request screen time
              </Button>
            )}
          </div>
        )}
        {!d.screen_time_enabled && d.rewards.length === 0 && (
          <p style={{ margin: 0, color: 'var(--f-sub)' }}>
            Nothing to spend points on yet. Keep finishing chores, then ask a parent to add rewards you can save up for.
          </p>
        )}
        {d.rewards.map((r) => {
          const pending = pendingReward(r.id)
          return (
            <div key={r.id} style={{ display: 'grid', gap: 6 }}>
              <strong>
                {r.icon} {r.name} · <span className="f-num">{r.price}</span> points
              </strong>
              <Progress
                value={Math.min(d.balance / r.price, 1) * 100}
                aria-label={`Progress toward ${r.name}`}
                aria-valuenow={Math.round(Math.min(d.balance / r.price, 1) * 100)}
              />
              {pending ? (
                <span className="f-pill" data-tone="wait">Waiting for a parent</span>
              ) : (
                <Button
                  disabled={d.balance < r.price || redeem.isPending}
                  onClick={() => redeem.mutate({ kind: 'reward', reward_id: r.id })}
                >
                  Request
                </Button>
              )}
            </div>
          )
        })}
      </div>
    </StickerCard>
  )
}
