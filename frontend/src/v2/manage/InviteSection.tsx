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
      <div className="m-form">
        <TextInput label="Their username" value={username} onChange={(e) => setUsername(e.currentTarget.value)} />
        <div className="m-actions">
          <Button
            disabled={username.trim().length < 3}
            loading={invite.isPending}
            onClick={() => invite.mutate(username.trim(), { onError: toastFail })}
          >
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
      </div>
    </section>
  )
}
