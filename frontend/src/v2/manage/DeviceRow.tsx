import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/router'
import { notifications } from '@mantine/notifications'
import { Button, MultiSelect, Switch, TextInput } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { DeviceQuickMenu } from '@/v2/today/DeviceQuickMenu'
import { useDeleteDevice, usePatchDevice, useTestBlock, type DevicePatch } from '@/v2/hooks/useDevices'
import type { Device, Kid } from '@/v2/types'
import { ConfirmDelete } from './ConfirmDelete'
import { toastFail, toastOk, toasts } from '../notify'

interface Props {
  device: Device
  kids: Kid[]
  focused?: boolean
  onDone?: () => void
}

const seen = (iso: string | null) => (iso ? new Date(iso).toLocaleString() : 'never')

export function DeviceRow({ device, kids, focused, onDone }: Props) {
  const router = useRouter()
  const patch = usePatchDevice()
  const del = useDeleteDevice()
  const test = useTestBlock()
  const [name, setName] = useState(device.name)
  const [confirm, { open, close }] = useDisclosure(false)
  const ref = useRef<HTMLDivElement>(null)

  // Find kids owned by this device that don't have PINs
  const owners = device.owner_ids.map(id => kids.find(k => k.id === id)).filter(Boolean) as Kid[]
  const ownerNames = owners.map(k => k.full_name || k.username)
  const needsPins = device.needs_pins && owners.length > 0

  useEffect(() => setName(device.name), [device.name])
  useEffect(() => {
    if (focused) ref.current?.scrollIntoView?.({ block: 'center' })
  }, [focused])

  const save = (p: DevicePatch, done: string) => patch.mutate({ id: device.id, patch: p }, toasts(done))
  const guest = device.status === 'guest'

  return (
    <div ref={ref} id={`device-${device.id}`} className="m-form" data-focused={focused || undefined}>
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
      <p className="m-meta">
        {device.vendor ?? 'Unknown maker'} · last seen {seen(device.last_seen)} ·{' '}
        <span className="f-pill" data-online={device.online}>
          {device.online ? 'online' : 'offline'}
        </span>
        {device.resisting && (
          <>
            {' '}
            <span className="f-pill" data-resisting>
              getting around the block
            </span>
          </>
        )}
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
      {needsPins && (
        <div style={{ padding: 12, border: '1px solid #e0e0e0', borderRadius: 4, backgroundColor: '#f9f9f9', marginTop: 12 }}>
          <p style={{ margin: '0 0 8px 0', fontSize: 13, color: '#666' }}>
            {ownerNames.join(' and ')} share this device. Add PINs so they can&apos;t sign in as each other.
          </p>
          <button
            onClick={() => {
              const firstKidId = device.owner_ids[0]
              router.push(`/kids?section=kids&kid=${firstKidId}&pin=1`)
            }}
            style={{
              padding: '6px 12px',
              backgroundColor: '#0070f3',
              color: 'white',
              border: 'none',
              borderRadius: 3,
              cursor: 'pointer',
              fontSize: 12,
            }}
          >
            Set PINs
          </button>
        </div>
      )}
      <div className="m-actions">
        <DeviceQuickMenu targets={{ kind: 'device', id: device.id }} label={device.name}>
          <Button variant="default">Lock options</Button>
        </DeviceQuickMenu>
        <Button
          variant="default"
          aria-label={`Test block on ${device.name}`}
          disabled={test.isPending}
          onClick={() =>
            test.mutate(device.id, {
              onSuccess: (r) =>
                r.reason === 'ok' ? toastOk(r.message) : notifications.show({ message: r.message, color: 'fridgeRed' }),
              onError: toastFail,
            })
          }
        >
          {test.isPending ? 'Testing…' : 'Test block'}
        </Button>
        <Button className="m-push" color="fridgeRed" variant="subtle" onClick={open}>
          Delete
        </Button>
      </div>
      <ConfirmDelete
        opened={confirm}
        title={`Delete ${device.name}?`}
        body="It will show up as a new device if it connects again."
        onConfirm={() => del.mutate(device.id, { onSuccess: onDone })}
        onClose={close}
      />
    </div>
  )
}
