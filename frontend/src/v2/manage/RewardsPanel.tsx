import { useState } from 'react'
import { Button, Drawer, NumberInput, TextInput } from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import { useDeleteReward, useRewards, useSaveReward } from '@/v2/hooks/useRewards'
import type { Reward } from '@/v2/types'
import { toastFail, toastOk } from '../notify'
import { Icon } from '@/v2/parent/Icon'

/** Parent rewards catalog: list, plus add/edit in a side drawer, delete. */
export function RewardsPanel() {
  const small = useMediaQuery('(max-width: 767px)')
  const rewards = useRewards()
  const save = useSaveReward()
  const del = useDeleteReward()
  const [opened, setOpened] = useState(false)
  const [editing, setEditing] = useState<Reward | null>(null)
  const [name, setName] = useState('')
  const [price, setPrice] = useState<number | string>(50)

  const show = (r: Reward | null) => {
    setEditing(r)
    setName(r?.name ?? '')
    setPrice(r?.price ?? 50)
    setOpened(true)
  }
  const submit = () =>
    save.mutate(
      { id: editing?.id, body: { name: name.trim(), price: Number(price) || 0 } },
      {
        onError: toastFail,
        onSuccess: () => {
          toastOk(editing ? 'Saved' : 'Added')
          setOpened(false)
        },
      },
    )

  return (
    <section aria-label="Rewards" className="m-main">
      <div className="f-title-row">
        <h2 className="f-display">Rewards</h2>
        <Button onClick={() => show(null)}>New reward</Button>
      </div>
      {rewards.data?.length === 0 && <p>No rewards yet. Add one with New reward.</p>}
      {!!rewards.data?.length && (
        <div className="f-card m-list">
          {rewards.data.map((r) => (
            <div key={r.id} className="m-rr">
              <span className="m-ico"><Icon name="redeem" /></span>
              <b className="m-grow">{r.name}</b>
              <span className="m-num">{r.price}</span>
              <Button variant="default" onClick={() => show(r)}>{`Edit ${r.name}`}</Button>
              <Button
                variant="default"
                loading={del.isPending && del.variables === r.id}
                onClick={() => del.mutate(r.id, { onError: toastFail, onSuccess: () => toastOk('Deleted') })}
              >{`Delete ${r.name}`}</Button>
            </div>
          ))}
        </div>
      )}
      <Drawer opened={opened} onClose={() => setOpened(false)} position="right" size={small ? '100%' : 'md'} title={editing ? 'Edit reward' : 'New reward'}>
        <div className="m-form">
          <TextInput label="Reward" value={name} maxLength={100} onChange={(e) => setName(e.currentTarget.value)} />
          <NumberInput label="Price (points)" min={1} max={100000} value={price} onChange={setPrice} />
          <div className="m-actions">
            <Button onClick={submit} disabled={!name.trim() || !(Number(price) >= 1)} loading={save.isPending}>
              {editing ? 'Save reward' : 'Add reward'}
            </Button>
            <Button variant="default" onClick={() => setOpened(false)}>
              Cancel
            </Button>
          </div>
        </div>
      </Drawer>
    </section>
  )
}
