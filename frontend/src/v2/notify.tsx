import { notifications } from '@mantine/notifications'
import { errorText } from './errorText'

/** Success toast reuses the action word ("Delete" -> "Deleted"). */
export const toastOk = (message: string) => notifications.show({ message, color: 'fridgeGreen' })

/** Error toast shows the backend detail from ApiError. */
export const toastFail = (e: unknown) =>
  notifications.show({
    title: "That didn't work",
    message: errorText(e),
    color: 'fridgeRed',
  })

/** Mutation callbacks: toast on success and on failure. */
export const toasts = (done: string) => ({ onSuccess: () => toastOk(done), onError: toastFail })
