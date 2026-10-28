import { useState } from 'react'
import { CopyButton, TextInput } from '@mantine/core'
import { useCancelInvite, useInvite, useInvites, useParents, useResetLink } from '@/v2/hooks/useFamily'
import { useSingleFlight } from '@/v2/hooks/useSingleFlight'
import { Icon } from '@/v2/parent/Icon'
import { ErrorPanel, Skeleton } from '@/v2/parent/states'
import { toastFail } from '../notify'
import { PaneCard, PaneHead } from './PaneParts'
import { lastActive } from './settingsMeta'

const left = (s: number) => (s >= 3600 ? `${Math.ceil(s / 3600)} h` : `${Math.max(1, Math.ceil(s / 60))} min`)

/** A link to copy, with its one-line note. */
function LinkRow({ label, url, note }: { label: string; url: string; note: string }) {
  return (
    <>
      <div className="pn-inp">
        <TextInput aria-label={label} readOnly value={url} className="pn-mask" />
        <CopyButton value={url}>
          {({ copied, copy }) => (
            <button type="button" className="p-btn pn-test" onClick={copy}>
              {copied ? 'Copied' : 'Copy link'}
            </button>
          )}
        </CopyButton>
      </div>
      <p className="pn-help pn-note">{note}</p>
    </>
  )
}

function InviteCard({ invite, onDone }: { invite: ReturnType<typeof useInvite>; onDone: () => void }) {
  const once = useSingleFlight()
  const [username, setUsername] = useState('')
  const name = username.trim()
  const link = invite.data ? `${window.location.origin}/register?token=${invite.data.token}` : ''
  return (
    <PaneCard icon="person_add" title="Invite a parent">
      <form
        className="pn-form"
        onSubmit={(e) => {
          e.preventDefault() // Enter in the field creates the link, once
          if (name.length >= 3) void once(() => invite.mutateAsync(name).catch(toastFail))
        }}
      >
        <TextInput label="Their username" value={username} onChange={(e) => setUsername(e.currentTarget.value)} />
        <div className="pn-row">
          <button type="submit" className="p-btn" data-variant="accent" disabled={name.length < 3 || invite.isPending || (!!invite.data && invite.variables === name)}>
            Create invite link
          </button>
          <button type="button" className="p-btn" onClick={onDone}>
            Done
          </button>
        </div>
        {link && <LinkRow label="Invite link" url={link} note="The link works once and expires in 24 hours." />}
      </form>
    </PaneCard>
  )
}

/** Settings → Parents (mockup 02): everyone who can manage the family, plus invites not yet used. */
export function ParentsPane() {
  const parents = useParents()
  const invites = useInvites()
  const cancel = useCancelInvite()
  const invite = useInvite()
  const reset = useResetLink()
  const [inviting, setInviting] = useState(false)
  const [shown, setShown] = useState<{ name: string; url: string } | null>(null)
  return (
    <div className="pn">
      <PaneHead title="Parents" sub="Everyone who can manage the family.">
        <button type="button" className="p-btn" data-variant="accent" onClick={() => setInviting(true)}>
          <Icon name="person_add" size={17} />
          Invite a parent
        </button>
      </PaneHead>
      {parents.isPending && <Skeleton rows={2} />}
      {parents.isError && <ErrorPanel kind="unreachable" error={parents.error} onRetry={() => parents.refetch()} />}
      {parents.data && (
        <section className="pn-card" aria-label="Parents">
          {parents.data.map((p) => {
            const name = p.full_name || p.username
            return (
              <div key={p.id} className="pn-par">
                <div className="pn-av" aria-hidden="true">{name.charAt(0).toUpperCase()}</div>
                <div className="pn-t2">
                  {name}
                  {p.is_me && ' (you)'}
                  <small>{lastActive(p.is_me ? new Date().toISOString() : p.last_active_at)}</small>
                </div>
                {p.is_owner && <span className="p-chip" data-tone="acc">Owner</span>}
                {!p.is_me && (
                  <button
                    type="button"
                    className="p-btn"
                    disabled={reset.isPending && reset.variables === p.id}
                    onClick={() =>
                      reset.mutate(p.id, { onSuccess: (r) => setShown({ name, url: r.url }), onError: toastFail })
                    }
                  >
                    <Icon name="key" size={17} />
                    Reset link
                  </button>
                )}
              </div>
            )
          })}
          {!!invites.data?.length && <div className="pn-cap">Pending invites</div>}
          {invites.data?.map((i) => (
            <div key={i.jti} className="pn-par">
              <div className="pn-av pn-av-soft" aria-hidden="true">{i.username.charAt(0).toUpperCase()}</div>
              <div className="pn-t2">
                {i.username}
                <small>Invite sent · expires in {left(i.expires_in)}</small>
              </div>
              <button
                type="button"
                className="p-btn"
                data-variant="red"
                aria-label={`Cancel invite for ${i.username}`}
                disabled={cancel.isPending && cancel.variables === i.jti}
                onClick={() =>
                  cancel.mutate(i.jti, {
                    onSuccess: () => invite.variables === i.username && invite.reset(), // the link just sent is dead too
                    onError: toastFail,
                  })
                }
              >
                Cancel
              </button>
            </div>
          ))}
        </section>
      )}
      {shown && (
        <PaneCard icon="key" title={`Reset link for ${shown.name}`}>
          <LinkRow label="Reset link" url={shown.url} note={`Send this to ${shown.name}. It works once, for 30 minutes.`} />
        </PaneCard>
      )}
      {inviting && <InviteCard invite={invite} onDone={() => setInviting(false)} />}
      <p className="pn-help">Every parent can approve chores, lock devices and change settings. Invite links last 24 hours; reset links 30 minutes.</p>
    </div>
  )
}
