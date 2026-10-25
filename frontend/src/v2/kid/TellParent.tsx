import { useState } from 'react'
import { Button, Drawer, Textarea } from '@mantine/core'
import { IconCircleCheck, IconMessageReport } from '@tabler/icons-react'
import { useSendNote } from '../hooks/useKid'
import type { KidChore } from '../types'

/** "Something wrong? Tell a parent" button and sheet of quick notes; shows the sent note afterwards. */
export function TellParent({ c }: { c: KidChore }) {
  const [open, setOpen] = useState(false)
  const [label, setLabel] = useState<string | null>(null)
  const [text, setText] = useState('')
  const send = useSendNote()
  const close = () => {
    setOpen(false)
    setLabel(null)
    setText('')
  }
  return (
    <div style={{ flexBasis: '100%', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
      {c.note ? (
        <span className="f-pill" data-tone="done">
          <IconCircleCheck size={16} aria-hidden />
          {`Note sent: ${c.note.label}`}
        </span>
      ) : (
        <Button variant="default" size="md" style={{ minHeight: 44 }} leftSection={<IconMessageReport size={20} aria-hidden />} onClick={() => setOpen(true)}>
          Something wrong? Tell a parent
        </Button>
      )}
      <Drawer opened={open} onClose={close} position="bottom" zIndex={400} title="Tell Mom or Dad">
        <div style={{ display: 'grid', gap: 10 }}>
          {c.notes!.map((n) => (
            <Button
              key={n.label}
              size="lg"
              variant={label === n.label ? 'filled' : 'default'}
              style={{ borderStyle: n.universal ? 'dashed' : 'solid' }}
              onClick={() => setLabel(n.label)}
            >
              {n.label}
            </Button>
          ))}
          <Textarea aria-label="Add a note (optional)" placeholder="Add a note (optional)" maxLength={200} value={text} onChange={(e) => setText(e.currentTarget.value)} />
          <Button
            size="lg"
            disabled={!label}
            loading={send.isPending}
            onClick={() => send.mutate({ chore: c.id, label: label!, text: text.trim() || undefined }, { onSuccess: close })}
          >
            Send
          </Button>
        </div>
      </Drawer>
    </div>
  )
}
