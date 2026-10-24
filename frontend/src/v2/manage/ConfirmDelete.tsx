import { Button, Group, Modal, Text } from '@mantine/core'

interface ConfirmProps {
  opened: boolean
  title: string
  body: string
  onConfirm: () => void
  onClose: () => void
}

export function ConfirmDelete({ opened, title, body, onConfirm, onClose }: ConfirmProps) {
  return (
    <Modal opened={opened} onClose={onClose} title={title} centered>
      <Text mb="md">{body}</Text>
      <Group justify="flex-end">
        <Button variant="default" onClick={onClose}>
          Keep
        </Button>
        <Button
          color="fridgeRed"
          onClick={() => {
            onConfirm()
            onClose()
          }}
        >
          Delete
        </Button>
      </Group>
    </Modal>
  )
}
