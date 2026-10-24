import { notifications } from '@mantine/notifications'
import { ReactNode } from 'react'
import { errorText } from './errorText'

/**
 * Custom notification content component that displays a message with an optional action button.
 */
function NotificationContent({
  message,
  onAction,
  actionLabel = 'Undo',
}: {
  message: string
  onAction?: () => void
  actionLabel?: string
}): ReactNode {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'space-between', width: '100%' }}>
      <span>{message}</span>
      {onAction && (
        <button
          onClick={onAction}
          style={{
            marginLeft: 'auto',
            background: 'none',
            border: 'none',
            color: 'inherit',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '12px',
            textDecoration: 'underline',
            padding: '2px 4px',
          }}
        >
          {actionLabel}
        </button>
      )}
    </div>
  )
}

/** Success toast reuses the action word ("Delete" -> "Deleted"). */
export const toastOk = (message: string, options?: { undo?: () => void }) => {
  notifications.show({
    message: options?.undo ? <NotificationContent message={message} onAction={options.undo} /> : message,
    color: 'fridgeGreen',
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
    message: <NotificationContent message={message} onAction={undo} />,
    color: 'fridgeGreen',
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
