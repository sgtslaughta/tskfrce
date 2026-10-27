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
}

export interface EmptyStateProps {
  icon: string
  title: string
  body: ReactNode
  /** icon tile colour: soft grey (default), accent for good news, red/amber for problems */
  tone?: 'soft' | 'acc' | 'red' | 'amb'
  actions?: StateAction[]
  children?: ReactNode
  /** h1 when the panel is the whole page (expired link, 404); h3 inside a page */
  heading?: 'h1' | 'h3'
}

/** Empty / error / done panel from mockup 05: icon tile, title, one line, pill actions. */
export function EmptyState({ icon, title, body, tone = 'soft', actions = [], children, heading: H = 'h3' }: EmptyStateProps) {
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
              <Link key={a.label} href={a.href} className="p-btn">
                <Icon name={a.icon} size={17} />
                {a.label}
              </Link>
            ) : (
              <button key={a.label} type="button" className="p-btn" onClick={a.onClick}>
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
    title: 'This invite has expired',
    body: 'Invites last 24 hours and reset links 30 minutes. Ask a parent for a new one.',
    tone: 'amb',
  },
}

/** Error panel. Pass `error` to show what actually failed instead of the stock line. */
export function ErrorPanel({ kind, error, onRetry }: { kind: ErrorKind; error?: unknown; onRetry?: () => void }) {
  const copy = ERROR_COPY[kind]
  const actions: StateAction[] =
    kind === 'notfound'
      ? [{ label: 'Go to Today', icon: 'home', href: '/' }]
      : kind === 'expired'
        ? [{ label: 'Back to log in', icon: 'login', href: '/login' }]
        : [{ label: 'Try again', icon: 'refresh', onClick: onRetry ?? (() => window.location.reload()) }]
  return (
    <EmptyState
      icon={copy.icon}
      title={copy.title}
      body={error ? errorText(error) : copy.body}
      tone={copy.tone}
      actions={actions}
      heading={kind === 'expired' || kind === 'notfound' ? 'h1' : 'h3'}
    >
      {kind === 'unreachable' && <AutoRetry onRetry={onRetry ?? (() => window.location.reload())} />}
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
