import { useState } from 'react'
import { Drawer } from '@mantine/core'
import { Icon } from '@/v2/parent/Icon'
import { useSendNote } from '../hooks/useKid'
import type { KidChore } from '../types'

/** "Tell Mom or Dad" bottom sheet of quick notes (08 sheet 2). Controlled by the caller. */
export function TellParentSheet({ c, opened, onClose }: { c: KidChore; opened: boolean; onClose: () => void }) {
  const [label, setLabel] = useState<string | null>(null)
  const [text, setText] = useState('')
  const send = useSendNote()
  const close = () => {
    setLabel(null)
    setText('')
    onClose()
  }
  return (
    <Drawer
      opened={opened}
      onClose={close}
      position="bottom"
      zIndex={400}
      title="Tell Mom or Dad"
      withCloseButton={false}
      classNames={{ content: 'k-tok k-sheet', header: 'k-sheet-head', title: 'k-sheet-title', body: 'k-sheet-body' }}
      styles={{
        inner: { justifyContent: 'center' },
        content: { height: 'auto', maxWidth: 560, maxHeight: '90vh', display: 'flex', flexDirection: 'column' },
        header: { borderBottom: 0, padding: '10px 16px 0', background: 'var(--k-card)' },
        title: { fontSize: 22, lineHeight: 1.2, fontWeight: 700, color: 'var(--k-ink)' },
        body: { overflowY: 'auto', padding: '4px 16px 26px' },
      }}
    >
      <p className="k-sheet-sub">{`About: ${c.title}`}</p>
      <div className="k-nts">
        {(c.notes ?? []).map((n) => (
          <button
            key={n.label}
            type="button"
            className="k-nt"
            data-u={n.universal || undefined}
            aria-pressed={label === n.label}
            onClick={() => setLabel(n.label)}
          >
            <Icon name={n.glyph} />
            {n.label}
          </button>
        ))}
      </div>
      <textarea
        className="k-ti"
        aria-label="Add a note (optional)"
        placeholder="Add a note (optional)"
        maxLength={200}
        rows={2}
        value={text}
        onChange={(e) => setText(e.currentTarget.value)}
      />
      <button
        type="button"
        className="k-cut"
        disabled={!label || send.isPending}
        onClick={() => send.mutate({ chore: c.id, label: label!, text: text.trim() || undefined }, { onSuccess: close })}
      >
        Send
        <Icon name="send" />
      </button>
    </Drawer>
  )
}
