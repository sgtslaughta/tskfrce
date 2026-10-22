import { useState } from 'react'
import { useRouter } from 'next/router'
import { Button, Drawer, Popover } from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import { useInbox, useMarkAllRead, useMarkRead, type InboxItem } from '../hooks/useInbox'

/** Where a parent's notification leads; kid items stay on the kid page. */
const target = (n: InboxItem): string | null =>
  n.run_id ? '/' : n.device_id ? `/devices?focus=${n.device_id}` : n.redemption_id ? '/' : null

const ago = (iso: string) => {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
  return m < 1 ? 'now' : m < 60 ? `${m} min` : m < 1440 ? `${Math.round(m / 60)} h` : `${Math.round(m / 1440)} d`
}

function List({ kid, onGo }: { kid: boolean; onGo: () => void }) {
  const router = useRouter()
  const inbox = useInbox(kid)
  const read = useMarkRead(kid)
  const readAll = useMarkAllRead(kid)
  const items = inbox.data?.items ?? []
  const open = (n: InboxItem) => {
    if (!n.read) read.mutate(n.id)
    const to = kid ? null : target(n)
    onGo()
    if (to) router.push(to)
  }
  return (
    <div className="f-bell-list">
      <div className="f-bell-head">
        <strong>Notifications</strong>
        {(inbox.data?.unread ?? 0) > 0 && (
          <Button variant="subtle" size="compact-sm" onClick={() => readAll.mutate(undefined)}>
            Mark all read
          </Button>
        )}
      </div>
      {items.length === 0 ? (
        <p className="f-cap f-bell-empty">{inbox.isError ? "Can't load notifications right now." : "You're all caught up."}</p>
      ) : (
        <ul>
          {items.map((n) => (
            <li key={n.id}>
              <button type="button" className="f-bell-item" data-unread={!n.read} onClick={() => open(n)}>
                <span className="f-bell-title">{n.title}</span>
                {n.body && <span className="f-cap">{n.body}</span>}
                <span className="f-cap">{ago(n.created_at)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** Notification bell: popover on desktop, full sheet under 768 px. `kid` uses the kid token. */
export function Bell({ kid = false }: { kid?: boolean }) {
  const [opened, setOpened] = useState(false)
  const small = useMediaQuery('(max-width: 767px)')
  const unread = useInbox(kid).data?.unread ?? 0
  const btn = (
    <button
      type="button"
      className="f-bell"
      aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
      onClick={() => setOpened((o) => !o)}
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
        <path d="M10.3 21a1.9 1.9 0 0 0 3.4 0" />
      </svg>
      {unread > 0 && <span className="f-bell-count">{unread > 9 ? '9+' : unread}</span>}
    </button>
  )
  const close = () => setOpened(false)
  if (small)
    return (
      <>
        {btn}
        <Drawer opened={opened} onClose={close} position="bottom" size="100%" title="Notifications">
          <List kid={kid} onGo={close} />
        </Drawer>
      </>
    )
  return (
    <Popover opened={opened} onChange={setOpened} position="bottom-end" width={360} shadow="md">
      <Popover.Target>{btn}</Popover.Target>
      <Popover.Dropdown className="f-bell-pop">
        <List kid={kid} onGo={close} />
      </Popover.Dropdown>
    </Popover>
  )
}
