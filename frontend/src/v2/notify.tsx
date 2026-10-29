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
          type="button"
          className="p-toast-act"
          aria-label={actionLabel}
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
  const id = `ok-${Math.random().toString(36).slice(2)}`
  const undo = options?.undo
  notifications.show({
    id,
    // closing first: a second click can't fire the undo twice
    message: undo ? <NotificationContent message={message} onAction={() => (notifications.hide(id), undo())} /> : message,
    color: 'fridgeGreen',
    icon: okIcon,
  })
}

/**
 * Error toast shows the backend detail from ApiError. With `retry` it also offers a "Retry" button
 * (closes the toast first, so a second click can't re-run it). Non-idempotent actions pass
 * `retryIfOffline(e, retry)`: a request that never arrived is safe to resend, a refused one is not.
 */
export const toastFail = (e: unknown, retry?: unknown) => {
  // `onError: toastFail` hands react-query's variables in as 2nd arg: only a function counts
  const again = typeof retry === 'function' ? (retry as () => void) : undefined
  const message = errorText(e)
  // view-as-kid refusals are expected, not failures: neutral toast, no error title
  if (message.startsWith('Preview only.')) return notifications.show({ message, color: 'gray' })
  const id = `fail-${Math.random().toString(36).slice(2)}`
  return notifications.show({
    id,
    title: "That didn't work",
    message: again ? (
      <NotificationContent message={message} actionLabel="Retry" onAction={() => (notifications.hide(id), again())} />
    ) : (
      message
    ),
    color: 'fridgeRed',
  })
}

/** `retry` only when the request never reached the server (fetch throws a TypeError); undefined otherwise. */
export const retryIfOffline = (e: unknown, retry: () => void) => (e instanceof TypeError ? retry : undefined)

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
