import { useState } from 'react'
import { Button, Select, TextInput } from '@mantine/core'
import { useAwardBadge, useCustomBadges, useDeleteBadge, useSaveBadge } from '@/v2/hooks/useCustomBadges'
import { useKids } from '@/v2/hooks/useKids'
import { TIER_NAMES } from '@/v2/tiers'
import type { CustomBadge } from '@/v2/types'
import { toastFail, toastOk } from '../notify'

/** Parent custom badges: list, add, edit, delete, and Award a kid (+1 tier). */
export function CustomBadgesPanel() {
  const badges = useCustomBadges()
  const kids = useKids().data ?? []
  const save = useSaveBadge()
  const del = useDeleteBadge()
  const award = useAwardBadge()
  const [editing, setEditing] = useState<CustomBadge | null>(null)
  const [name, setName] = useState('')
  const [icon, setIcon] = useState('')
  const [description, setDescription] = useState('')
  const [kid, setKid] = useState<string | null>(null)

  const reset = () => {
    setEditing(null)
    setName('')
    setIcon('')
    setDescription('')
  }
  const edit = (b: CustomBadge) => {
    setEditing(b)
    setName(b.name)
    setIcon(b.icon)
    setDescription(b.description)
  }
  const submit = () =>
    save.mutate(
      { id: editing?.id, body: { name: name.trim(), icon: icon.trim(), description: description.trim() } },
      {
        onError: toastFail,
        onSuccess: () => {
          toastOk(editing ? 'Saved' : 'Added')
          reset()
        },
      },
    )
  const give = (b: CustomBadge) =>
    award.mutate(
      { id: b.id, kid_id: Number(kid) },
      { onError: toastFail, onSuccess: (r) => toastOk(`${b.name}: ${TIER_NAMES[r.tier - 1]}`) },
    )

  return (
    <section className="f-card" aria-label="Badges">
      <h2 className="f-display f-card-head">Badges</h2>
      <Select
        label="Award to"
        placeholder="Pick a kid"
        data={kids.map((k) => ({ value: String(k.id), label: k.full_name ?? k.username }))}
        value={kid}
        onChange={setKid}
      />
      {badges.data?.map((b) => (
        <div key={b.id} className="f-row">
          <span style={{ flex: 1 }}>
            {b.icon} {b.name} <span className="f-cap">{b.description}</span>
          </span>
          <Button disabled={!kid} loading={award.isPending && award.variables?.id === b.id} onClick={() => give(b)}>{`Award ${b.name}`}</Button>
          <Button variant="default" onClick={() => edit(b)}>{`Edit ${b.name}`}</Button>
          <Button
            variant="default"
            loading={del.isPending && del.variables === b.id}
            onClick={() => del.mutate(b.id, { onError: toastFail, onSuccess: () => toastOk('Deleted') })}
          >{`Delete ${b.name}`}</Button>
        </div>
      ))}
      <TextInput label="Badge name" value={name} maxLength={60} onChange={(e) => setName(e.currentTarget.value)} />
      <TextInput label="Emoji" value={icon} maxLength={8} onChange={(e) => setIcon(e.currentTarget.value)} />
      <TextInput label="Description" value={description} maxLength={200} onChange={(e) => setDescription(e.currentTarget.value)} />
      <div className="f-row">
        <Button onClick={submit} disabled={!name.trim() || !icon.trim()} loading={save.isPending}>
          {editing ? 'Save badge' : 'Add badge'}
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
