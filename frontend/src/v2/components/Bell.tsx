import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { EmptyState, ErrorPanel, Skeleton } from '@/v2/parent/states'
import { useRouter } from 'next/router'
import { Drawer, Popover, Tooltip } from '@mantine/core'
import { useQueryClient } from '@tanstack/react-query'
import { useMediaQuery } from '@mantine/hooks'
import { useDismiss, useInbox, useMarkAllRead, useMarkRead, type Inbox, type InboxItem } from '../hooks/useInbox'
import { askOnFirstClick, dest, useOsNotify } from '../osNotify'
import { useApproveChore, useSendBack } from '../hooks/useToday'
import { useDecideRedemption } from '../hooks/useRewards'
import { Icon } from '../parent/Icon'
import { toastFail, toastOk } from '../notify'
import { api } from '../api'
import { isAlert, isNeedsYou, isToday, severity, when } from './bellRules'
import { BellActions } from './BellActions'

type FilterKind = 'all' | 'needs-you' | 'alerts'
const TABS: { key: FilterKind; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'needs-you', label: 'Needs you' },
  { key: 'alerts', label: 'Alerts' },
]
/** "Alerts · 3": no count until the inbox has loaded; "+" only when older pages may add to a non-zero count. */
export const tabLabel = (label: string, n: number | undefined, more: boolean) =>
  n === undefined ? label : `${label} · ${n}${more && n > 0 ? '+' : ''}`
const SETTINGS = '/settings?section=notifications'

/** The notification list: inside the bell popover, the phone sheet (`sheet`) or the see-all page (`page`). */
export function List({ onGo, sheet, page }: { onGo: () => void; sheet?: boolean; page?: boolean }) {
  const router = useRouter()
  const inbox = useInbox(false)
  const read = useMarkRead(false)
  const readAll = useMarkAllRead(false)
  const dismiss = useDismiss(false)
  const approve = useApproveChore()
  const sendBack = useSendBack()
  const decideRedemption = useDecideRedemption()
  // the server sends the newest page; "Show older" appends further pages (the 30 s poll only refreshes the first)
  const [older, setOlder] = useState<{ items: InboxItem[]; more: boolean } | null>(null)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const items = useMemo(() => {
    const first = inbox.data?.items ?? []
    const seen = new Set(first.map((i) => i.id))
    return older ? [...first, ...older.items.filter((i) => !seen.has(i.id))] : first
  }, [inbox.data?.items, older])
  const hasMore = older ? older.more : !!inbox.data?.has_more
  const showOlder = async () => {
    const last = items.at(-1)
    if (!last || loadingOlder) return
    setLoadingOlder(true)
    try {
      const page = await api<Inbox>(`/notifications?before=${last.id}`, { kid: false })
      setOlder({ items: [...(older?.items ?? []), ...page.items], more: page.has_more })
    } catch (e) {
      toastFail(e)
    } finally {
      setLoadingOlder(false)
    }
  }
  const [filter, setFilter] = useState<FilterKind>('all')
  const [sending, setSending] = useState<number | null>(null)
  const [note, setNote] = useState('')

  const filtered = useMemo(
    () => items.filter((n) => (filter === 'needs-you' ? isNeedsYou(n) : filter === 'alerts' ? isAlert(n) : true)),
    [items, filter],
  )
  const byGroup = useMemo(
    () => ({ today: filtered.filter((n) => isToday(n.created_at)), earlier: filtered.filter((n) => !isToday(n.created_at)) }),
    [filtered],
  )
  const counts: Record<FilterKind, number> = useMemo(
    () => ({ all: items.length, 'needs-you': items.filter(isNeedsYou).length, alerts: items.filter(isAlert).length }),
    [items],
  )

  // one request per notification at a time (a double click or Enter-mash must not send twice)
  const qc = useQueryClient()
  const inflight = useRef(new Set<number>())
  const [busy, setBusy] = useState<number | null>(null)
  const act = (n: InboxItem, go: () => Promise<unknown>, ok: string) => {
    if (inflight.current.has(n.id)) return Promise.resolve(false)
    inflight.current.add(n.id)
    setBusy(n.id)
    return go()
      .then(() => (toastOk(ok), true), (e) => (toastFail(e), qc.invalidateQueries({ queryKey: ['inbox'] }), qc.invalidateQueries({ queryKey: ['today'] }), false))
      .finally(() => (inflight.current.delete(n.id), setBusy((b) => (b === n.id ? null : b))))
  }
  const markRead = (n: InboxItem) => { if (!n.read) read.mutate(n.id) }

  const handleApprove = (n: InboxItem) => {
    if (n.run_id) void act(n, () => approve.mutateAsync(n.run_id!), 'Approved').then((ok) => ok && markRead(n))
  }

  /** First click opens the note box; the box stays open (with its text) when the request fails. */
  const handleSendBack = async (n: InboxItem) => {
    if (sending !== n.id) return (setSending(n.id), setNote(''))
    if (!n.run_id || !note.trim()) return
    const ok = await act(n, () => sendBack.mutateAsync({ id: n.run_id!, note: note.trim() }), 'Sent back')
    if (!ok) return
    markRead(n)
    setSending(null)
    setNote('')
  }

  const handleDecide = (n: InboxItem, yes: boolean) => {
    if (n.redemption_id)
      void act(n, () => decideRedemption.mutateAsync({ id: n.redemption_id!, approve: yes }), yes ? 'Approved' : 'Declined').then((ok) => ok && markRead(n))
  }

  /** Mark read, close the bell and go to `to`. */
  const goTo = (n: InboxItem, to: string | null): Promise<unknown> => {
    markRead(n)
    onGo()
    return to ? router.push(to) : Promise.resolve()
  }
  const row = (n: InboxItem, today: boolean) => {
    const sev = severity(n)
    const sub = [n.body, when(n.created_at)].filter(Boolean).join(' · ')
    return (
      <div key={n.id} className={`p-bell-item ${!n.read ? 'unread' : ''}`}>
        <div className={`p-bell-icon ${sev.tone}`}>
          <Icon name={sev.name} />
        </div>
        <button type="button" className="p-bell-text" onClick={() => (dest(n) ? goTo(n, dest(n)) : markRead(n))}>
          <span className="p-bell-title">{n.title}</span>
          {sub && <span className="p-bell-sub">{sub}</span>}
        </button>
        <button type="button" className="p-bell-x" aria-label={`Dismiss ${n.title}`} onClick={() => dismiss.mutate(n.id)}>
          <Icon name="close" size={16} />
        </button>
        {(today || n.pending) && (
          <BellActions
            n={n}
            busy={busy === n.id}
            sending={sending === n.id}
            note={note}
            onNote={setNote}
            onApprove={() => handleApprove(n)}
            onSendBack={() => void handleSendBack(n)}
            onDecide={(yes) => handleDecide(n, yes)}
            go={(to) => goTo(n, to)}
          />
        )}
      </div>
    )
  }
  const empty = items.length === 0

  return (
    <div className="p-bell-list" data-sheet={sheet || undefined} data-page={page || undefined}>
      <div className="p-bell-head">
        {sheet || page ? <span /> : <strong>Notifications</strong>}
        {(inbox.data?.unread ?? 0) > 0 && (
          <button type="button" className="p-bell-mark-read" onClick={() => readAll.mutate(undefined)}>
            Mark all read
          </button>
        )}
      </div>
      <div className="p-bell-tabs">
        {TABS.map((t) => (
          <button key={t.key} type="button" className={`p-bell-tab ${filter === t.key ? 'on' : ''}`} data-autofocus={filter === t.key || undefined} onClick={() => setFilter(t.key)}>
            {tabLabel(t.label, inbox.data && counts[t.key], hasMore)}
          </button>
        ))}
      </div>
      {filtered.length === 0 ? (
        inbox.isError || inbox.failureCount > 0 ? (
          <ErrorPanel kind="unreachable" error={inbox.error ?? inbox.failureReason} onRetry={() => inbox.refetch()} />
        ) : !inbox.data ? (
          <Skeleton rows={3} />
        ) : (
          <EmptyState
            icon="notifications_off"
            title={filter === 'alerts' ? 'No alerts' : 'No notifications'}
            body={
              filter === 'alerts'
                ? "We'll tell you if a device resists or the box goes offline."
                : "We'll ping you when a chore needs your OK."
            }
            actions={empty && !page ? [{ icon: 'tune', label: 'Notification settings', href: SETTINGS }] : []}
          />
        )
      ) : (
        <div className="p-bell-scroll" tabIndex={0} role="region" aria-label="Notification list">
          {byGroup.today.length > 0 && <div className="p-bell-group">Today</div>}
          {byGroup.today.map((n) => row(n, true))}
          {byGroup.earlier.length > 0 && <div className="p-bell-group">Earlier</div>}
          {byGroup.earlier.map((n) => row(n, false))}
        </div>
      )}
      {hasMore && (
        <button type="button" className="p-btn p-bell-older" disabled={loadingOlder} data-loading={loadingOlder} onClick={showOlder}>
          Show older
        </button>
      )}
      {!page && !empty && (
        <div className="p-bell-foot">
          <Link href={SETTINGS} onClick={onGo}>
            <Icon name="tune" size={16} />
            Notification settings
          </Link>
          <Link href="/notifications" onClick={onGo}>
            See all
            <Icon name="chevron_right" size={16} />
          </Link>
        </div>
      )}
    </div>
  )
}

/** Parent notification bell: popover on desktop, full sheet under 768 px. */
export function Bell({ placement = 'header' }: { placement?: 'rail' | 'header' }) {
  const [opened, setOpened] = useState(false)
  const small = useMediaQuery('(max-width: 767px)')
  const inbox = useInbox(false)
  const unread = inbox.data?.unread ?? 0
  const router = useRouter()
  const fromOs = useCallback((n: InboxItem) => {
    const to = dest(n)
    if (to) void router.push(to)
  }, [router])
  useOsNotify(inbox.data?.items, fromOs)
  useEffect(askOnFirstClick, [])

  // Escape closes the desktop popover wherever focus is (focus stays on the bell)
  useEffect(() => {
    if (!opened) return
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpened(false) }
    window.addEventListener('keydown', esc, true)
    return () => window.removeEventListener('keydown', esc, true)
  }, [opened])

  // On mobile, don't render bell for rail placement (header only)
  if (placement === 'rail' && small) {
    return null
  }

  const btn = (
    <button
      type="button"
      className="p-bell"
      aria-label={unread ? `Notifications, ${unread > 9 ? '9+' : unread} unread` : 'Notifications'}
      onClick={() => setOpened((o) => !o)}
    >
      <Icon name="notifications" size={22} />
      {unread > 0 && <span className="p-bell-count">{unread > 9 ? '9+' : unread}</span>}
    </button>
  )
  const close = () => setOpened(false)
  if (small)
    return (
      <>
        {btn}
        <Drawer
          opened={opened}
          onClose={close}
          position="bottom"
          size="100%"
          title="Notifications"
          closeButtonProps={{ 'aria-label': 'Close notifications' }}
          classNames={{ title: 'p-bell-drawer-title', header: 'p-bell-drawer-header', content: 'p-bell-drawer-content', close: 'p-bell-drawer-close' }}
        >
          <List onGo={close} sheet />
        </Drawer>
      </>
    )
  return (
    <Popover
      opened={opened}
      onChange={setOpened}
      position={placement === 'rail' ? 'right-start' : 'bottom-end'}
      width={400}
      trapFocus
      returnFocus
      // §2.2 pointer and sticker shadow (CSS)
      withArrow
      arrowSize={14}
      arrowOffset={20}
      offset={12}
      classNames={{ arrow: 'p-bell-arrow' }}
    >
      <Tooltip label="Notifications" openDelay={400} disabled={opened}>
        <Popover.Target>{btn}</Popover.Target>
      </Tooltip>
      <Popover.Dropdown aria-label="Notifications" className="p-pop p-bell-pop">
        <List onGo={close} />
      </Popover.Dropdown>
    </Popover>
  )
}
