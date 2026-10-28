import { useState } from 'react'
import { Icon } from '../parent/Icon'
import { useKidRewards, useRedeem } from '../hooks/useKidRewards'
import type { KidAge } from './modes/types'

const STEPS = [15, 30, 45, 60, 75, 90, 105, 120]
const opts = (left: number | null) => {
  const m = left === null ? STEPS : STEPS.filter((x) => x <= left)
  return m.map((x) => ({ value: String(x), label: `${x} minutes` }))
}
const CHIP = { little: 'lg', kid: 'md', teen: 'sm' } as const

/** Rewards (Prizes in Little) tab, dressed in the age mode's look (see kid-rewards.css). */
export function RewardsSection({ onExpired, mode = 'kid' }: { onExpired: () => void; mode?: KidAge }) {
  const { data: d } = useKidRewards(onExpired)
  const redeem = useRedeem(onExpired)
  const [minutes, setMinutes] = useState('30')
  const [got, setGot] = useState<number[]>([])
  if (!d?.pending) return null
  const sc = d.screen
  const held = d.pending.reduce((n, p) => n + p.cost, 0) // asked-for points can't be spent twice
  const free = d.balance - held
  const data = opts(sc.left_today)
  const mins = data.some((o) => o.value === minutes) ? minutes : (data.find((o) => Number(o.value) >= 30) ?? data[data.length - 1])?.value ?? minutes
  const why =
    sc.left_today !== null && sc.left_today < 15
      ? "You've had all your screen time for today."
      : sc.min_points !== null && d.balance < sc.min_points
        ? `You can buy screen time once you have ${sc.min_points} points.`
        : sc.only_in_hours && !sc.in_hours
          ? 'Screen time only works during your allowed hours.'
          : !sc.only_in_hours && sc.off_now
            ? "Screen time can't turn the internet on during off hours."
            : null
  const pendingReward = (id: number) => d.pending.some((p) => p.kind === 'reward' && p.reward_id === id)
  const pendingTime = d.pending.some((p) => p.kind === 'screen_time')
  const cost = (Number(mins) / 15) * d.screen_time_price
  const chip = CHIP[mode]
  const wait = (
    <span className="k-chip" data-tone="wait" data-size={chip}>
      <Icon name="hourglass_top" />
      Waiting for a parent
    </span>
  )
  return (
    <div className="r-view" data-mode={mode}>
      <h1 className="r-head k-disp">
        {mode === 'little' ? 'Prizes' : 'Rewards'}
        <span className="k-sr"> · </span>
        <span className="k-chip" data-tone="sun" data-size={mode === 'little' ? 'lg' : 'md'}>
          <Icon name="star" fill />
          <b>{free}</b> points
        </span>
      </h1>
      {held > 0 && <p className="r-sub">{`${held} points are held for requests a parent hasn't answered yet.`}</p>}
      <div className="r-list">
        {d.screen_time_enabled && (
          <div className="r-item">
            <span className="r-ic" data-tone="blue">
              <Icon name="timer" />
            </span>
            <div className="r-body">
              <label className="r-name k-disp" htmlFor="r-minutes">
                Screen time
              </label>
              <select id="r-minutes" className="r-sel" value={mins} onChange={(e) => setMinutes(e.currentTarget.value)}>
                {data.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <p className="r-sub">
                Costs <b>{cost}</b> points
              </p>
              {sc.max_today !== null && (
                <p className="r-sub">
                  {sc.bought_today} of {sc.max_today} min today
                </p>
              )}
              {why && <p className="r-sub">{why}</p>}
            </div>
            <div className="r-act">
              {pendingTime ? (
                wait
              ) : (
                <button
                  type="button"
                  className="r-btn"
                  disabled={!!why || !data.length || cost > free || redeem.isPending}
                  onClick={() => redeem.mutate({ kind: 'screen_time', minutes: Number(mins) })}
                >
                  {sc.auto ? 'Get screen time' : 'Request screen time'}
                </button>
              )}
            </div>
          </div>
        )}
        {!d.screen_time_enabled && d.rewards.length === 0 && (
          <p className="r-empty">
            Nothing to spend points on yet. Keep finishing chores, then ask a parent to add rewards you can save up for.
          </p>
        )}
        {d.rewards.map((r) => {
          const pending = pendingReward(r.id)
          const instant = r.needs_approval === false
          const pct = Math.min(Math.max(free, 0) / r.price, 1) * 100
          return (
            <div key={r.id} className="r-item">
              <span className="r-ic">
                <Icon name={r.icon ?? 'redeem'} />
              </span>
              <div className="r-body">
                <span className="r-name k-disp">{r.name}</span>
                <p className="r-sub">
                  <b>{r.price}</b> points
                </p>
                <div className="r-bar" role="progressbar" aria-label={`Progress toward ${r.name}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)}>
                  <i style={{ width: `${pct}%` }} />
                </div>
              </div>
              <div className="r-act">
                {got.includes(r.id) ? (
                  <span className="k-chip" data-tone="done" data-size={chip}>
                    <Icon name="check" />
                    It&apos;s yours!
                  </span>
                ) : pending ? (
                  wait
                ) : (
                  <button
                    type="button"
                    className="r-btn"
                    disabled={free < r.price || redeem.isPending}
                    onClick={() =>
                      redeem.mutate(
                        { kind: 'reward', reward_id: r.id },
                        { onSuccess: (res) => (res as { status?: string } | undefined)?.status === 'approved' && setGot((g) => [...g, r.id]) },
                      )
                    }
                  >
                    {instant ? 'Get it' : 'Request'}
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
