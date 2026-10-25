import { Modal, Text } from '@mantine/core'

interface ConfirmProps {
  opened: boolean
  title: string
  body: string
  onConfirm: () => void
  onClose: () => void
}

export function ConfirmDelete({ opened, title, body, onConfirm, onClose }: ConfirmProps) {
  return (
    <Modal opened={opened} onClose={onClose} title={title} centered styles={{ title: { fontWeight: 700, color: 'var(--p-ink)' } }}>
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
            onConfirm()
            onClose()
          }}
        >
          Delete
        </button>
      </div>
    </Modal>
  )
}
