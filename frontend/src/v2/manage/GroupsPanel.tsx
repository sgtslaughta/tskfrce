import { useState } from 'react'
import { Button, Drawer, MultiSelect, TextInput } from '@mantine/core'
import { useDisclosure, useMediaQuery } from '@mantine/hooks'
import { DeviceQuickMenu } from '@/v2/today/DeviceQuickMenu'
import { useDeleteGroup, useGroups, useSaveGroup } from '@/v2/hooks/useDevices'
import type { Device, Group } from '@/v2/types'
import { ConfirmDelete } from './ConfirmDelete'
import { toastFail, toastOk } from '../notify'

function GroupForm({ group, devices, onDone }: { group?: Group; devices: Device[]; onDone: () => void }) {
  const save = useSaveGroup()
  const del = useDeleteGroup()
  const [name, setName] = useState(group?.name ?? '')
  const [ids, setIds] = useState<string[]>(group?.device_ids.map(String) ?? [])
  const [confirm, { open, close }] = useDisclosure(false)
  const unchanged =
    !!group && name.trim() === group.name && [...ids].sort().join() === group.device_ids.map(String).sort().join()
  const data = devices.map((d) => ({ value: String(d.id), label: d.name }))

  const submit = () =>
    save.mutate(
      { id: group?.id, name: name.trim(), device_ids: ids.map(Number) },
      {
        onError: toastFail,
        onSuccess: () => {
          toastOk(group ? 'Saved' : 'Created')
          onDone()
        },
      },
    )

  return (
    <div className="m-form">
      <TextInput
        label="Group name"
        placeholder="Group name"
        value={name}
        onChange={(e) => setName(e.currentTarget.value)}
      />
      <MultiSelect label="Devices" data={data} value={ids} onChange={setIds} />
      <div className="m-actions">
        <Button onClick={submit} disabled={!name.trim() || unchanged} loading={save.isPending}>
          {group ? 'Save group' : 'Create group'}
        </Button>
        {group && (
          <>
            <DeviceQuickMenu targets={{ kind: 'group', id: group.id }} label={group.name}>
              <Button variant="default">Lock options</Button>
            </DeviceQuickMenu>
            <Button className="m-push" color="fridgeRed" variant="subtle" onClick={open}>
              Delete group
            </Button>
          </>
        )}
      </div>
      {group && (
        <ConfirmDelete
          opened={confirm}
          title={`Delete ${group.name}?`}
          body="The devices stay. This group's hours are removed."
          onConfirm={() => del.mutate(group.id, { onSuccess: onDone })}
          onClose={close}
        />
      )}
    </div>
  )
}

export function GroupsPanel({ devices }: { devices: Device[] }) {
  const groups = useGroups()
  const small = useMediaQuery('(max-width: 767px)')
  const [open, setOpen] = useState<{ group?: Group } | null>(null)
  const close = () => setOpen(null)
  const list = groups.data ?? []
  return (
    <section aria-label="Groups">
      <div className="f-title-row">
        <h2 className="f-display">Groups</h2>
        <Button onClick={() => setOpen({})}>New group</Button>
      </div>
      {list.length === 0 && <p className="m-empty">No groups yet. Make one to set hours for several devices at once.</p>}
      {list.length > 0 && (
        <div className="f-card m-list">
          {list.map((g) => (
            <button key={g.id} type="button" className="m-row" onClick={() => setOpen({ group: g })}>
              <b>{g.name}</b>
              <span className="m-meta">
                {g.device_ids.length} {g.device_ids.length === 1 ? 'device' : 'devices'}
              </span>
            </button>
          ))}
        </div>
      )}
      <Drawer opened={open !== null} onClose={close} position="right" size={small ? '100%' : 'md'} title={open?.group ? 'Edit group' : 'New group'}>
        <GroupForm key={open?.group?.id ?? 'new'} group={open?.group} devices={devices} onDone={close} />
      </Drawer>
    </section>
  )
}
