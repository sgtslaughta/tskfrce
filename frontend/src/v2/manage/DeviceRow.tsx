import { useEffect, useRef, useState } from 'react'
import { Button, MultiSelect, Switch, TextInput } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { DeviceQuickMenu } from '@/v2/today/DeviceQuickMenu'
import { useDeleteDevice, usePatchDevice, type DevicePatch } from '@/v2/hooks/useDevices'
import type { Device, Kid } from '@/v2/types'
import { ConfirmDelete, toasts } from './notify'

interface Props {
  device: Device
  kids: Kid[]
  focused?: boolean
}

const seen = (iso: string | null) => (iso ? new Date(iso).toLocaleString() : 'never')

export function DeviceRow({ device, kids, focused }: Props) {
  const patch = usePatchDevice()
  const del = useDeleteDevice()
  const [name, setName] = useState(device.name)
  const [confirm, { open, close }] = useDisclosure(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => setName(device.name), [device.name])
  useEffect(() => {
    if (focused) ref.current?.scrollIntoView?.({ block: 'center' })
  }, [focused])

  const save = (p: DevicePatch, done: string) => patch.mutate({ id: device.id, patch: p }, toasts(done))
  const guest = device.status === 'guest'

  return (
    <div ref={ref} id={`device-${device.id}`} className="f-card" data-focused={focused || undefined}>
      <TextInput
        aria-label="Device name"
        value={name}
        onChange={(e) => setName(e.currentTarget.value)}
        onBlur={() => {
          const n = name.trim()
          if (!n) setName(device.name)
          else if (n !== device.name) save({ name: n }, 'Renamed')
        }}
      />
      <p>
        {device.vendor ?? 'Unknown maker'} · last seen {seen(device.last_seen)} ·{' '}
        <span className="f-pill" data-online={device.online}>
          {device.online ? 'online' : 'offline'}
        </span>
      </p>
      <MultiSelect
        label="Owners"
        placeholder="Pick kids"
        data={kids.map((k) => ({ value: String(k.id), label: k.full_name ?? k.username }))}
        value={device.owner_ids.map(String)}
        onChange={(v) => save({ owner_ids: v.map(Number) }, 'Assigned')}
        disabled={guest}
      />
      <Switch
        label="Guest"
        checked={guest}
        onChange={(e) =>
          save({ status: e.currentTarget.checked ? 'guest' : device.owner_ids.length ? 'assigned' : 'unassigned' }, 'Saved')
        }
      />
      <DeviceQuickMenu targets={{ kind: 'device', id: device.id }} label={device.name}>
        <Button variant="default">Lock options</Button>
      </DeviceQuickMenu>
      <Button color="fridgeRed" variant="light" onClick={open}>
        Delete
      </Button>
      <ConfirmDelete
        opened={confirm}
        title={`Delete ${device.name}?`}
        body="It will show up as a new device if it connects again."
        onConfirm={() => del.mutate(device.id, toasts('Deleted'))}
        onClose={close}
      />
    </div>
  )
}
