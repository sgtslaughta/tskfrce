import { useState } from 'react'
import { Button, NativeSelect, Progress } from '@mantine/core'
import { Icon } from '../parent/Icon'
import { StickerCard } from '../components/StickerCard'
import { useKidRewards, useRedeem } from '../hooks/useKidRewards'

const STEPS = [15, 30, 45, 60, 75, 90, 105, 120]
const opts = (left: number | null) => {
  const m = left === null ? STEPS : STEPS.filter((x) => x <= left)
  return m.map((x) => ({ value: String(x), label: `${x} minutes` }))
}

export function RewardsSection({ onExpired, heading = 'Rewards' }: { onExpired: () => void; heading?: string }) {
  const { data: d } = useKidRewards(onExpired)
  const redeem = useRedeem(onExpired)
  const [minutes, setMinutes] = useState('30')
  const [got, setGot] = useState<number[]>([])
  if (!d?.pending) return null
  const sc = d.screen
  const data = opts(sc.left_today)
  const mins = data.some((o) => o.value === minutes) ? minutes : (data.find((o) => Number(o.value) >= 30) ?? data[data.length - 1])?.value ?? minutes
  const why =
    sc.left_today !== null && sc.left_today < 15
      ? "You've had all your screen time for today."
      : sc.min_points !== null && d.balance < sc.min_points
        ? `You can buy screen time once you have ${sc.min_points} points.`
        : sc.only_in_hours && !sc.in_hours
          ? 'Screen time only works during your allowed hours.'
          : null
  const pendingReward = (id: number) => d.pending.some((p) => p.kind === 'reward' && p.reward_id === id)
  const pendingTime = d.pending.some((p) => p.kind === 'screen_time')
  const cost = (Number(mins) / 15) * d.screen_time_price
  return (
    <StickerCard>
      <div style={{ display: 'grid', gap: 12 }}>
        <h1 style={{ margin: 0, fontSize: 24 }}>
          {heading} · <span className="f-num">{d.balance}</span> points
        </h1>
        {d.screen_time_enabled && (
          <div style={{ display: 'grid', gap: 8 }}>
            <NativeSelect
              label="Screen time"
              data={data}
              value={mins}
              onChange={(e) => setMinutes(e.currentTarget.value)}
            />
            <p style={{ margin: 0 }}>
              Costs <span className="f-num">{cost}</span> points
            </p>
            {sc.max_today !== null && (
              <p className="f-cap" style={{ margin: 0 }}>
                {sc.bought_today} of {sc.max_today} min today
              </p>
            )}
            {why && <p style={{ margin: 0, color: 'var(--f-sub)' }}>{why}</p>}
            {pendingTime ? (
              <span className="f-pill" data-tone="wait">Waiting for a parent</span>
            ) : (
              <Button
                disabled={!!why || !data.length || cost > d.balance || redeem.isPending}
                onClick={() => redeem.mutate({ kind: 'screen_time', minutes: Number(mins) })}
              >
                {sc.auto ? 'Get screen time' : 'Request screen time'}
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
          const instant = r.needs_approval === false
          return (
            <div key={r.id} style={{ display: 'grid', gap: 6 }}>
              <strong style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <Icon name={r.icon ?? 'redeem'} size={22} /> {r.name} · <span className="f-num">{r.price}</span> points
              </strong>
              <Progress
                value={Math.min(d.balance / r.price, 1) * 100}
                aria-label={`Progress toward ${r.name}`}
              />
              {got.includes(r.id) ? (
                <span className="f-pill" data-tone="ok">It&apos;s yours!</span>
              ) : pending ? (
                <span className="f-pill" data-tone="wait">Waiting for a parent</span>
              ) : (
                <Button
                  disabled={d.balance < r.price || redeem.isPending}
                  onClick={() =>
                    redeem.mutate(
                      { kind: 'reward', reward_id: r.id },
                      { onSuccess: (res) => (res as { status?: string } | undefined)?.status === 'approved' && setGot((g) => [...g, r.id]) },
                    )
                  }
                >
                  {instant ? 'Get it' : 'Request'}
                </Button>
              )}
            </div>
          )
        })}
      </div>
    </StickerCard>
  )
}
