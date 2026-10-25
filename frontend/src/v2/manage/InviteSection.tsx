import { useState } from 'react'
import { Button, CopyButton, Text, TextInput } from '@mantine/core'
import { useInvite } from '@/v2/hooks/useFamily'
import { toastFail } from '../notify'

export function InviteSection() {
  const invite = useInvite()
  const [username, setUsername] = useState('')
  const link = invite.data ? `${window.location.origin}/register?token=${invite.data.token}` : ''
  return (
    <section aria-label="Invite another parent" className="f-card m-card">
      <h2 className="f-display">Invite another parent</h2>
      <form
        className="m-form"
        onSubmit={(e) => {
          e.preventDefault() // Enter in the field creates the link, once
          if (username.trim().length >= 3 && !invite.isPending) invite.mutate(username.trim(), { onError: toastFail })
        }}
      >
        <TextInput label="Their username" value={username} onChange={(e) => setUsername(e.currentTarget.value)} />
        <div className="m-actions">
          <Button type="submit" disabled={username.trim().length < 3} loading={invite.isPending}>
            Create invite link
          </Button>
        </div>
        {link && (
          <>
            <div className="m-actions">
              <TextInput aria-label="Invite link" readOnly value={link} style={{ flex: 1 }} />
              <CopyButton value={link}>
                {({ copied, copy }) => <Button onClick={copy}>{copied ? 'Copied' : 'Copy link'}</Button>}
              </CopyButton>
            </div>
            <Text className="m-help">The link works once and expires in 24 hours.</Text>
          </>
        )}
      </form>
    </section>
  )
}
