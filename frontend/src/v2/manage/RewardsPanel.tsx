import { useState } from 'react'
import { Button, NumberInput, TextInput } from '@mantine/core'
import { useDeleteReward, useRewards, useSaveReward } from '@/v2/hooks/useRewards'
import type { Reward } from '@/v2/types'
import { toastFail, toastOk } from '../notify'

/** Parent rewards catalog: list, add, edit, delete. */
export function RewardsPanel() {
  const rewards = useRewards()
  const save = useSaveReward()
  const del = useDeleteReward()
  const [editing, setEditing] = useState<Reward | null>(null)
  const [name, setName] = useState('')
  const [price, setPrice] = useState<number | string>(50)
  const [icon, setIcon] = useState('')

  const reset = () => {
    setEditing(null)
    setName('')
    setPrice(50)
    setIcon('')
  }
  const edit = (r: Reward) => {
    setEditing(r)
    setName(r.name)
    setPrice(r.price)
    setIcon(r.icon ?? '')
  }
  const submit = () =>
    save.mutate(
      { id: editing?.id, body: { name: name.trim(), price: Number(price) || 0, ...(icon.trim() && { icon: icon.trim() }) } },
      {
        onError: toastFail,
        onSuccess: () => {
          toastOk(editing ? 'Saved' : 'Added')
          reset()
        },
      },
    )

  return (
    <section className="f-card" aria-label="Rewards">
      <h2 className="f-display f-card-head">Rewards</h2>
      {rewards.data?.map((r) => (
        <div key={r.id} className="f-row">
          <span style={{ flex: 1 }}>
            {r.icon} {r.name} <span className="f-num">{r.price}</span>
          </span>
          <Button variant="default" onClick={() => edit(r)}>{`Edit ${r.name}`}</Button>
          <Button
            variant="default"
            loading={del.isPending && del.variables === r.id}
            onClick={() => del.mutate(r.id, { onError: toastFail, onSuccess: () => toastOk('Deleted') })}
          >{`Delete ${r.name}`}</Button>
        </div>
      ))}
      <TextInput label="Reward" value={name} maxLength={100} onChange={(e) => setName(e.currentTarget.value)} />
      <NumberInput label="Price (points)" min={1} max={100000} value={price} onChange={setPrice} />
      <TextInput label="Emoji (optional)" value={icon} maxLength={8} onChange={(e) => setIcon(e.currentTarget.value)} />
      <div className="f-row">
        <Button onClick={submit} disabled={!name.trim() || !(Number(price) >= 1)} loading={save.isPending}>
          {editing ? 'Save reward' : 'Add reward'}
        </Button>
        {editing && (
          <Button variant="default" onClick={reset}>
            Cancel
          </Button>
        )}
      </div>
    </section>
  )
}
