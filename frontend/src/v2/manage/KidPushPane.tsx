import { useDisclosure } from '@mantine/hooks'
import { Switch, Text } from '@mantine/core'
import { InfoBlock } from '@/v2/components/InfoBlock'
import { useFamily, usePatchFamily } from '@/v2/hooks/useFamily'
import { useKidPush, useResetKidPush } from '@/v2/hooks/useKidPush'
import { useKids } from '@/v2/hooks/useKids'
import { Icon } from '@/v2/parent/Icon'
import type { Kid } from '@/v2/types'
import { toastFail, toastOk } from '@/v2/notify'
import { ConfirmDelete } from './ConfirmDelete'
import { initial, nameOf } from './choreMeta'

function KidPhone({ kid }: { kid: Kid }) {
  const push = useKidPush(kid.id)
  const reset = useResetKidPush()
  const [confirm, { open, close }] = useDisclosure(false)
  const name = nameOf(kid)
  const d = push.data
  if (!d?.enabled) return null
  return (
    <section className="pk-panel" aria-label={`${name} phone`}>
      <h3>
        <span className="pk-av" aria-hidden="true">{kid.avatar || initial(name)}</span>
        {name}
      </h3>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img alt={`Kid phone code for ${name}`} className="pk-qr" width={168} height={168} src={`data:image/svg+xml;utf8,${encodeURIComponent(d.qr_svg)}`} />
      <p className="pk-hint">1. Install the ntfy app on {name}&apos;s phone. 2. Scan this code with the phone camera.</p>
      <p className="pk-hint">
        Or add it by hand: server <span className="pk-mono">{d.server}</span>, topic <span className="pk-mono">{d.topic}</span>
      </p>
      <div className="pk-actions">
        <button type="button" className="p-btn" onClick={open} disabled={reset.isPending}>
          <Icon name="qr_code_2" />
          New code
        </button>
      </div>
      <ConfirmDelete
        opened={confirm}
        title="Make a new code?"
        body={`${name}'s phone stops getting alerts until you scan the new code.`}
        confirmLabel="New code"
        onConfirm={() => reset.mutate(kid.id, { onSuccess: () => toastOk('New code ready') })}
        onClose={close}
      />
    </section>
  )
}

/** Settings → Notifications: per-kid ntfy codes, plus the family-wide iPhone relay switch. */
export function KidPushPane() {
  const kids = useKids().data ?? []
  const fam = useFamily().data
  const patch = usePatchFamily()
  const first = kids[0]
  // the ntfy service is box-wide, so the first kid's answer tells us if it is on
  const on = useKidPush(first?.id ?? 0, !!first).data?.enabled
  return (
    <>
      {on === false ? (
        <InfoBlock icon="info" text="Kid phone alerts need the ntfy service on the box. Update the box, then come back here." />
      ) : (
        <InfoBlock
          icon="notifications"
          text="Kids get chore alerts on their own phone through the box. Nothing leaves your home unless you turn on iPhone alerts below."
        />
      )}
      {on && fam && (
        <section className="pk-panel" aria-label="iPhone alerts">
          <Switch
            label="Instant alerts on iPhones (relays through ntfy.sh)"
            checked={fam.ntfy_upstream_relay}
            onChange={(e) => patch.mutate({ ntfy_upstream_relay: e.currentTarget.checked }, { onError: toastFail })}
          />
          <Text className="m-help">When on, notification text passes through ntfy.sh. Off keeps everything in your home; iPhones then get alerts late.</Text>
        </section>
      )}
      {on && kids.map((k) => <KidPhone key={k.id} kid={k} />)}
    </>
  )
}
