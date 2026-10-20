import { useState } from 'react'
import { Button, MultiSelect, TextInput } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { DeviceQuickMenu } from '@/v2/today/DeviceQuickMenu'
import { useDeleteGroup, useGroups, useSaveGroup } from '@/v2/hooks/useDevices'
import type { Device, Group } from '@/v2/types'
import { ConfirmDelete, toastFail, toastOk, toasts } from './notify'

function GroupForm({ group, devices }: { group?: Group; devices: Device[] }) {
  const save = useSaveGroup()
  const del = useDeleteGroup()
  const [name, setName] = useState(group?.name ?? '')
  const [ids, setIds] = useState<string[]>(group?.device_ids.map(String) ?? [])
  const [confirm, { open, close }] = useDisclosure(false)
  const data = devices.map((d) => ({ value: String(d.id), label: d.name }))

  const submit = () =>
    save.mutate(
      { id: group?.id, name: name.trim(), device_ids: ids.map(Number) },
      {
        onError: toastFail,
        onSuccess: () => {
          toastOk(group ? 'Saved' : 'Created')
          if (!group) {
            setName('')
            setIds([])
          }
        },
      },
    )

  return (
    <div className="f-card">
      <TextInput
        label={group ? 'Group name' : undefined}
        aria-label={group ? undefined : 'New group name'}
        placeholder="Group name"
        value={name}
        onChange={(e) => setName(e.currentTarget.value)}
      />
      <MultiSelect label="Devices" data={data} value={ids} onChange={setIds} />
      <Button onClick={submit} disabled={!name.trim()} loading={save.isPending}>
        {group ? 'Save group' : 'Create group'}
      </Button>
      {group && (
        <>
          <DeviceQuickMenu targets={{ kind: 'group', id: group.id }} label={group.name}>
            <Button variant="default">Lock options</Button>
          </DeviceQuickMenu>
          <Button color="fridgeRed" variant="light" onClick={open}>
            Delete group
          </Button>
          <ConfirmDelete
            opened={confirm}
            title={`Delete ${group.name}?`}
            body="The devices stay. Their group hours are removed."
            onConfirm={() => del.mutate(group.id, toasts('Deleted'))}
            onClose={close}
          />
        </>
      )}
    </div>
  )
}

export function GroupsPanel({ devices }: { devices: Device[] }) {
  const groups = useGroups()
  return (
    <section aria-label="Groups">
      <h2 className="f-display">Groups</h2>
      {groups.data?.map((g) => <GroupForm key={`${g.id}-${g.name}-${g.device_ids.join()}`} group={g} devices={devices} />)}
      <GroupForm devices={devices} />
    </section>
  )
}
