import { useState } from 'react'
import { Button, CopyButton, Text, TextInput } from '@mantine/core'
import { useParents, useResetLink } from '@/v2/hooks/useFamily'
import { toastFail } from '../notify'

/** Parents on this box. Another parent can make a one-time password reset link for you. */
export function ParentsList() {
  const parents = useParents()
  const reset = useResetLink()
  const [shown, setShown] = useState<{ id: number; name: string; url: string } | null>(null)
  return (
    <section aria-label="Parents" className="f-card m-card">
      <h2 className="f-display">Parents</h2>
      <ul className="m-list">
        {parents.data?.map((p) => {
          const name = p.full_name || p.username
          return (
            <li key={p.id} className="m-actions">
              <span>
                {name} {p.is_me && <span className="m-help">(you)</span>}
              </span>
              {!p.is_me && (
                <Button
                  className="m-push"
                  size="xs"
                  variant="default"
                  loading={reset.isPending && reset.variables === p.id}
                  onClick={() =>
                    reset.mutate(p.id, {
                      onSuccess: (r) => setShown({ id: p.id, name, url: r.url }),
                      onError: toastFail,
                    })
                  }
                >
                  Reset password
                </Button>
              )}
            </li>
          )
        })}
      </ul>
      {shown && (
        <div className="m-form">
          <div className="m-actions">
            <TextInput aria-label="Reset link" readOnly value={shown.url} style={{ flex: 1 }} />
            <CopyButton value={shown.url}>
              {({ copied, copy }) => <Button onClick={copy}>{copied ? 'Copied' : 'Copy link'}</Button>}
            </CopyButton>
          </div>
          <Text className="m-help">Send this to {shown.name}. It works once, for 30 minutes.</Text>
        </div>
      )}
    </section>
  )
}
