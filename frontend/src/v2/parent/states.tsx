import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { Icon } from './Icon'
import { errorText } from '../errorText'

export interface StateAction {
  label: string
  icon: string
  href?: string
  onClick?: () => void
  /** the main action: ink-filled (mockup 05 .btn.pri) */
  primary?: boolean
}

export interface EmptyStateProps {
  icon: string
  title: string
  body: ReactNode
  /** icon tile colour: soft grey (default), accent for good news, red/amber for problems, sun = the kid-look sticker */
  tone?: 'soft' | 'acc' | 'red' | 'amb' | 'sun'
  actions?: StateAction[]
  children?: ReactNode
  /** h1 when the panel is the whole page (expired link, 404); h2 inside a page (default); h3 under an h2 */
  heading?: 'h1' | 'h2' | 'h3'
}

/** Empty / error / done panel from mockup 05: icon tile, title, one line, pill actions. */
export function EmptyState({ icon, title, body, tone = 'soft', actions = [], children, heading: H = 'h2' }: EmptyStateProps) {
  return (
    <div className="p-state" role={tone === 'red' ? 'alert' : undefined}>
      <div className="p-state-icon" data-tone={tone}>
        <Icon name={icon} size={26} />
      </div>
      <H className="p-state-title">{title}</H>
      <p className="p-state-body">{body}</p>
      {actions.length > 0 && (
        <div className="p-state-actions">
          {actions.map((a) =>
            a.href ? (
              <Link key={a.label} href={a.href} className="p-btn" data-variant={a.primary ? 'ink' : undefined}>
                <Icon name={a.icon} size={17} />
                {a.label}
              </Link>
            ) : (
              <button key={a.label} type="button" className="p-btn" data-variant={a.primary ? 'ink' : undefined} onClick={a.onClick}>
                <Icon name={a.icon} size={17} />
                {a.label}
              </button>
            ),
          )}
        </div>
      )}
      {children}
    </div>
  )
}

/** Loading skeleton: placeholder rows shaped like list cards. */
export function Skeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="p-skeleton" role="status" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="p-sk-row">
          <i />
          <span>
            <b />
            <b />
          </span>
        </div>
      ))}
    </div>
  )
}

export type ErrorKind = 'unreachable' | 'crash' | 'notfound' | 'expired'

const ERROR_COPY: Record<ErrorKind, { icon: string; title: string; body: string; tone: EmptyStateProps['tone'] }> = {
  unreachable: {
    icon: 'wifi_off',
    title: "Can't reach your home box",
    body: "Are you on the home Wi-Fi? If you're away, connect Tailscale first.",
    tone: 'red',
  },
  crash: {
    icon: 'sentiment_dissatisfied',
    title: 'Something went wrong',
    body: 'This page hit an error. Your data is safe.',
    tone: 'red',
  },
  notfound: { icon: 'link_off', title: "That page isn't here", body: 'The link may be old, or the chore was deleted.', tone: 'soft' },
  expired: {
    icon: 'timer_off',
    title: "This invite can't be used",
    body: 'It may have expired or already been used. Ask a parent for a new one.',
    tone: 'amb',
  },
}

/** Error panel. Pass `error` to show what actually failed instead of the stock line. */
export function ErrorPanel({
  kind,
  error,
  title,
  onRetry,
  onAutoRetry,
  heading,
  detail,
}: {
  kind: ErrorKind
  error?: unknown
  title?: string
  onRetry?: () => void
  /** unreachable only: the quiet timed retry (defaults to onRetry) */
  onAutoRetry?: () => void
  /** h1 when the panel is the whole page */
  heading?: 'h1' | 'h2'
  /** crash only: text behind the "Copy details" button */
  detail?: string
}) {
  const copy = ERROR_COPY[kind]
  const actions: StateAction[] =
    kind === 'crash'
      ? [
          { label: 'Reload', icon: 'refresh', primary: true, onClick: () => window.location.reload() },
          { label: 'Copy details', icon: 'content_copy', onClick: () => void navigator.clipboard?.writeText(detail ?? '').catch(() => {}) },
        ]
      : kind === 'notfound'
      ? [{ label: 'Go to Today', icon: 'home', href: '/', primary: true }]
      : kind === 'expired'
        ? [{ label: 'Back to log in', icon: 'login', href: '/login' }]
        : [{ label: 'Try again', icon: 'refresh', primary: true, onClick: onRetry ?? (() => window.location.reload()) }]
  return (
    <EmptyState
      icon={copy.icon}
      title={title ?? copy.title}
      body={error ? errorText(error) : copy.body}
      tone={copy.tone}
      actions={actions}
      heading={heading ?? (kind === 'expired' || kind === 'notfound' ? 'h1' : 'h2')}
    >
      {kind === 'unreachable' && <AutoRetry onRetry={onAutoRetry ?? onRetry ?? (() => window.location.reload())} />}
    </EmptyState>
  )
}

const RETRY_EVERY = 8

/** Mockup 05 "Retrying in 8s…": the can't-reach panel tries again by itself. */
function AutoRetry({ onRetry }: { onRetry: () => void }) {
  const [left, setLeft] = useState(RETRY_EVERY)
  const retry = useRef(onRetry)
  retry.current = onRetry
  const count = useRef(RETRY_EVERY)
  useEffect(() => {
    const t = setInterval(() => {
      count.current -= 1
      if (count.current <= 0) {
        count.current = RETRY_EVERY
        retry.current()
      }
      setLeft(count.current)
    }, 1000)
    return () => clearInterval(t)
  }, [])
  return (
    <p className="p-state-retry" aria-live="off">
      {`Retrying in ${left}s…`}
    </p>
  )
}

/** Whole-page "something is happening" state (mockup 05 redirects and box start): icon or dots, a line, maybe a bar. */
export function WaitingState({ icon, title, body, bar, note }: { icon?: string; title: string; body?: ReactNode; bar?: boolean; note?: ReactNode }) {
  return (
    <div className="p-state" role="status">
      {icon ? (
        <div className="p-state-icon" data-tone="acc">
          <Icon name={icon} size={26} />
        </div>
      ) : (
        <div className="p-dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </div>
      )}
      <h1 className="p-state-title">{title}</h1>
      {body && <p className="p-state-body">{body}</p>}
      {bar && (
        <div className="p-bar" aria-hidden="true">
          <i />
        </div>
      )}
      {note && <p className="p-state-retry">{note}</p>}
    </div>
  )
}

/** "Starting your home box": the proxy is up but the backend behind it isn't yet. */
export const BoxStarting = () => (
  <WaitingState
    icon="power_settings_new"
    title="Starting your home box"
    body="First start on a Raspberry Pi can take a few minutes."
    bar
    note="Trying again every few seconds…"
  />
)

/** "Let's finish setting up": an unfinished wizard sends the parent back to its step. */
export const SetupResuming = ({ step }: { step: number }) => (
  <WaitingState icon="auto_fix_high" title="Let's finish setting up" body={`Taking you to setup, step ${step} of 7…`} bar />
)

/** "Opening Homework · Mia": a link from a notification, while its page loads. */
export const OpeningLink = ({ label }: { label?: string }) => (
  <WaitingState title={label ? `Opening ${label}` : 'Opening your link'} body="From your notification" />
)
