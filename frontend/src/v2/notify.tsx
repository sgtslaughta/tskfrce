import { notifications } from '@mantine/notifications'
import { errorText } from './errorText'

/** Success toast reuses the action word ("Delete" -> "Deleted"). */
export const toastOk = (message: string, options?: { undo?: () => void }) => {
  notifications.show({
    message,
    color: 'fridgeGreen',
    action: options?.undo ? { label: 'Undo', onClick: options.undo } : undefined,
  })
}

/** Error toast shows the backend detail from ApiError. */
export const toastFail = (e: unknown) =>
  notifications.show({
    title: "That didn't work",
    message: errorText(e),
    color: 'fridgeRed',
  })

/** Mutation callbacks: toast on success and on failure. */
export const toasts = (done: string) => ({ onSuccess: () => toastOk(done), onError: toastFail })

/**
 * Show an undo toast immediately and run an async action after a delay.
 * If the user clicks Undo, cancel the action.
 */
export function withUndo<T>(
  run: () => Promise<T>,
  message: string,
  ms: number = 5000
): void {
  let cancelled = false;
  let timeoutId: NodeJS.Timeout | null = null;

  const undo = () => {
    cancelled = true;
    if (timeoutId) clearTimeout(timeoutId);
    notifications.show({ message: 'Undone', color: 'fridgeGreen' });
  };

  notifications.show({
    message,
    color: 'fridgeGreen',
    action: { label: 'Undo', onClick: undo },
  });

  timeoutId = setTimeout(async () => {
    if (!cancelled) {
      try {
        await run();
      } catch (e) {
        toastFail(e);
      }
    }
  }, ms);
}
