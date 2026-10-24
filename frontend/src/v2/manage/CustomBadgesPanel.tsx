import { useState } from 'react'
import { Button, Drawer, Select, TextInput } from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import { GlyphPicker } from '@/v2/parent/GlyphPicker'
import { Icon } from '@/v2/parent/Icon'
import { useAwardBadge, useCustomBadges, useDeleteBadge, useSaveBadge } from '@/v2/hooks/useCustomBadges'
import { useKids } from '@/v2/hooks/useKids'
import { TIER_NAMES } from '@/v2/tiers'
import type { CustomBadge } from '@/v2/types'
import { toastFail, toastOk } from '../notify'

const BADGE_GLYPHS = ['military_tech', 'verified', 'star', 'favorite', 'emoji_events', 'trophy', 'celebration']

/** Parent custom badges: list, add, edit, delete, and Award a kid (+1 tier). */
export function CustomBadgesPanel() {
  const small = useMediaQuery('(max-width: 767px)')
  const badges = useCustomBadges()
  const kids = useKids().data ?? []
  const save = useSaveBadge()
  const del = useDeleteBadge()
  const award = useAwardBadge()
  const [opened, setOpened] = useState(false)
  const [editing, setEditing] = useState<CustomBadge | null>(null)
  const [name, setName] = useState('')
  const [icon, setIcon] = useState('')
  const [description, setDescription] = useState('')
  const [kid, setKid] = useState<string | null>(null)

  const show = (b: CustomBadge | null) => {
    setEditing(b)
    setName(b?.name ?? '')
    setIcon(b?.icon ?? '')
    setDescription(b?.description ?? '')
    setOpened(true)
  }
  const submit = () =>
    save.mutate(
      { id: editing?.id, body: { name: name.trim(), icon: icon.trim(), description: description.trim() } },
      {
        onError: toastFail,
        onSuccess: () => {
          toastOk(editing ? 'Saved' : 'Added')
          setOpened(false)
        },
      },
    )
  const give = (b: CustomBadge) =>
    award.mutate(
      { id: b.id, kid_id: Number(kid) },
      { onError: toastFail, onSuccess: (r) => toastOk(`${b.name}: ${TIER_NAMES[r.tier - 1]}`) },
    )

  return (
    <section aria-label="Badges" className="m-main">
      <div className="f-title-row">
        <h2 className="f-display">Badges</h2>
        <Button onClick={() => show(null)}>New badge</Button>
      </div>
      <Select
        label="Award to"
        placeholder="Pick a kid"
        data={kids.map((k) => ({ value: String(k.id), label: k.full_name ?? k.username }))}
        value={kid}
        onChange={setKid}
      />
      {badges.data?.length === 0 && <p>No custom badges yet. Add one with New badge.</p>}
      {!!badges.data?.length && (
        <div className="f-card m-list">
          {badges.data.map((b) => (
            <div key={b.id} className="m-rr">
              <span className="m-ico"><Icon name={b.icon} size={20} /></span>
              <span className="m-grow">
                <b>{b.name}</b>
                <span className="m-meta">{b.description}</span>
              </span>
              <Button disabled={!kid} loading={award.isPending && award.variables?.id === b.id} onClick={() => give(b)}>{`Award ${b.name}`}</Button>
              <Button variant="default" onClick={() => show(b)}>{`Edit ${b.name}`}</Button>
              <Button
                variant="default"
                loading={del.isPending && del.variables === b.id}
                onClick={() => del.mutate(b.id, { onError: toastFail, onSuccess: () => toastOk('Deleted') })}
              >{`Delete ${b.name}`}</Button>
            </div>
          ))}
        </div>
      )}
      <Drawer opened={opened} onClose={() => setOpened(false)} position="right" size={small ? '100%' : 'md'} title={editing ? 'Edit badge' : 'New badge'}>
        <div className="m-form">
          <TextInput label="Badge name" value={name} maxLength={60} onChange={(e) => setName(e.currentTarget.value)} />
          <div>
            <label htmlFor="badge-glyph" className="f-label">Icon</label>
            <GlyphPicker value={icon} onChange={setIcon} choices={BADGE_GLYPHS} />
          </div>
          <TextInput label="Description" value={description} maxLength={200} onChange={(e) => setDescription(e.currentTarget.value)} />
          <div className="m-actions">
            <Button onClick={submit} disabled={!name.trim() || !icon.trim()} loading={save.isPending}>
              {editing ? 'Save badge' : 'Add badge'}
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
