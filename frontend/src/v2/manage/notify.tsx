import { Button, Group, Modal, Text } from '@mantine/core'
import { notifications } from '@mantine/notifications'

/** Success toast reuses the action word ("Delete" -> "Deleted"). */
export const toastOk = (message: string) => notifications.show({ message, color: 'fridgeGreen' })

/** Error toast shows the backend detail from ApiError. */
export const toastFail = (e: unknown) =>
  notifications.show({
    title: "That didn't work",
    message: e instanceof Error ? e.message : 'Check your connection and try again.',
    color: 'fridgeRed',
  })

/** Mutation callbacks: toast on success and on failure. */
export const toasts = (done: string) => ({ onSuccess: () => toastOk(done), onError: toastFail })

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
