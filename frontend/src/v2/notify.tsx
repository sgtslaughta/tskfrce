import { notifications } from '@mantine/notifications'
import { ReactNode } from 'react'
import { errorText } from './errorText'
import { Icon } from './parent/Icon'

const okIcon = <Icon name="check" size={16} />

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
          className="p-toast-act"
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
    icon: okIcon,
  })
}

/** Error toast shows the backend detail from ApiError. */
export const toastFail = (e: unknown) => {
  const message = errorText(e)
  // view-as-kid refusals are expected, not failures: neutral toast, no error title
  if (message.startsWith('Preview only.')) return notifications.show({ message, color: 'gray' })
  return notifications.show({ title: "That didn't work", message, color: 'fridgeRed' })
}

/** Mutation callbacks: toast on success and on failure. */
export const toasts = (done: string) => ({ onSuccess: () => toastOk(done), onError: toastFail })

/** Same for a mutateAsync promise (use inside a single-flight `once`). */
export const toasted = (p: Promise<unknown>, done: string) => p.then(() => toastOk(done), toastFail)

/**
 * Show an undo toast immediately and run an async action after a delay.
 * If the user clicks Undo, cancel the action. Resolves once the action ran (or was undone), never rejects.
 */
export function withUndo<T>(
  run: () => Promise<T>,
  message: string,
  ms: number = 5000
): Promise<void> {
  let cancelled = false;
  let timeoutId: NodeJS.Timeout | null = null;
  let settle: () => void = () => {};
  const settled = new Promise<void>((r) => { settle = r; });

  const id = `undo-${Date.now()}-${Math.random()}`;
  const undo = () => {
    cancelled = true;
    if (timeoutId) clearTimeout(timeoutId);
    settle();
    notifications.hide(id);
    notifications.show({ message: 'Undone', color: 'fridgeGreen', icon: okIcon });
  };

  notifications.show({
    id,
    message: <NotificationContent message={message} onAction={undo} />,
    color: 'fridgeGreen',
    icon: okIcon,
  });

  timeoutId = setTimeout(async () => {
    if (!cancelled) {
      try {
        await run();
      } catch (e) {
        toastFail(e);
      }
    }
    settle();
  }, ms);
  return settled;
}
