import { useEffect, useRef } from 'react'
import { Modal, Text } from '@mantine/core'

interface ConfirmProps {
  opened: boolean
  title: string
  body: string
  /** Confirm button text. Default "Delete". */
  confirmLabel?: string
  onConfirm: () => void
  onClose: () => void
}

export function ConfirmDelete({ opened, title, body, confirmLabel = 'Delete', onConfirm, onClose }: ConfirmProps) {
  // the dialog fades out for a moment: a second click in that moment must not confirm again
  const sent = useRef(false)
  useEffect(() => {
    if (opened) sent.current = false
  }, [opened])
  return (
    <Modal opened={opened} onClose={onClose} title={title} centered zIndex={400} styles={{ title: { fontWeight: 700, color: 'var(--p-ink)' } }}>
      <Text mb="md">{body}</Text>
      <div className="pk-actions">
        <button type="button" className="p-btn" onClick={onClose}>
          Keep
        </button>
        <button
          type="button"
          className="p-btn"
          data-variant="red"
          onClick={() => {
            if (sent.current) return
            sent.current = true
            onConfirm()
            onClose()
          }}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  )
}
