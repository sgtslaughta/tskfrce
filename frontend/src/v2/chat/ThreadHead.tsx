import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { Menu } from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import { Icon } from '@/v2/parent/Icon'
import { Chip, type ChipTone } from '@/v2/parent/Chip'
import { threadGlyph } from '@/v2/today/choreIcon'
import { useApproveChore, useSendBack, useToday } from '@/v2/hooks/useToday'
import { useDeduct } from '@/v2/hooks/useKids'
import { withUndo } from '@/v2/notify'
import type { RunDetail } from '@/v2/types'
import type { ThreadKind } from '@/v2/hooks/useChat'

const STATE: Record<RunDetail['state'], { tone: ChipTone; icon: string; label: string }> = {
  needs_you: { tone: 'lav', icon: 'hourglass_top', label: 'Needs OK' },
  done: { tone: 'grey', icon: 'check_circle', label: 'Approved' },
  todo: { tone: 'grey', icon: 'radio_button_unchecked', label: 'To do' },
  skipped: { tone: 'grey', icon: 'do_not_disturb_on', label: 'Skipped' },
}
const AMOUNTS = [5, 10, 20]

/** Type tile + title; chore threads add state/points chips and Approve / Send back / Deduct from the run. */
export function ThreadHead({ kind, title, run, glyph }: { kind: ThreadKind; title: string; run?: RunDetail; glyph?: string | null }) {
  const router = useRouter()
  const small = useMediaQuery('(max-width: 767px)')
  const approve = useApproveChore()
  const sendBack = useSendBack()
  const deduct = useDeduct()
  const kidName = useToday().data?.kids.find((k) => k.id === run?.kid_ids[0])?.name ?? 'your kid'
  const [form, setForm] = useState<'back' | 'deduct' | null>(null)
  const [note, setNote] = useState('')
  const [amount, setAmount] = useState<number | null>(10)
  const [custom, setCustom] = useState('')
  const [why, setWhy] = useState('')
  const take = amount ?? Number(custom)
  const toggle = (f: 'back' | 'deduct') => setForm(form === f ? null : f)
  const tile =
    kind === 'chore' ? <Icon name={threadGlyph(glyph, title)} size={24} /> : kind === 'family' ? <Icon name="group" size={24} /> : <b>{(title.trim()[0] ?? '?').toUpperCase()}</b>
  const s = run && STATE[run.state]
  const { item: _item, ...rest } = router.query
  const doApprove = () => run && withUndo(() => approve.mutateAsync(run.id), `Approved +${run.points}`)

  return (
    <div className="pc-head">
      <div className="pc-head-row">
        {small && !!router.query.item && (
          <Link href={{ pathname: router.pathname, query: rest }} className="pc-back" aria-label="Back to chats">
            <Icon name="chevron_left" size={22} />
          </Link>
        )}
        <div className="pc-tile" data-big>{tile}</div>
        <div className="pc-head-t">
          <h2>{title}</h2>
          {run && s && (
            <div className="pc-chips">
              {!small && <Chip tone="grey" icon={run.type.glyph}>{run.type.name}</Chip>}
              <Chip tone={s.tone} icon={s.icon}>{s.label}</Chip>
              <Chip tone="grey" icon="stars" className="pc-pts">{run.points} pts</Chip>
            </div>
          )}
        </div>
        {run && small && (
          <Menu position="bottom-end" withinPortal>
            <Menu.Target>
              <button type="button" className="pc-ib" aria-label="Actions" title="Actions">
                <Icon name="more_vert" size={20} />
              </button>
            </Menu.Target>
            <Menu.Dropdown>
              {run.state === 'needs_you' && (
                <>
                  <Menu.Item leftSection={<Icon name="check" size={17} />} onClick={doApprove}>
                    Approve +{run.points}
                  </Menu.Item>
                  <Menu.Item leftSection={<Icon name="undo" size={17} />} onClick={() => toggle('back')}>
                    Send back
                  </Menu.Item>
                </>
              )}
              {run.kid_ids.length > 0 && (
                <Menu.Item color="red" leftSection={<Icon name="remove_circle" size={17} />} onClick={() => toggle('deduct')}>
                  Deduct
                </Menu.Item>
              )}
            </Menu.Dropdown>
          </Menu>
        )}
        {run && !small && (
          <div className="pc-acts">
            {run.state === 'needs_you' && (
              <>
                <button className="p-btn" data-variant="accent" onClick={doApprove}>
                  <Icon name="check" size={17} />
                  Approve
                </button>
                <button className="p-btn" aria-expanded={form === 'back'} onClick={() => toggle('back')}>
                  <Icon name="undo" size={17} />
                  Send back
                </button>
              </>
            )}
            {run.kid_ids.length > 0 && (
              <button className="p-btn" data-variant="red" aria-expanded={form === 'deduct'} onClick={() => toggle('deduct')}>
                <Icon name="remove_circle" size={17} />
                Deduct
              </button>
            )}
          </div>
        )}
      </div>

      {run && form === 'back' && (
        <form
          className="pt-ded"
          data-tone="ink"
          onSubmit={(e) => {
            e.preventDefault()
            sendBack.mutate({ id: run.id, note: note.trim() }, { onSuccess: () => {
              setForm(null)
              setNote('')
            } })
          }}
        >
          <b>What should {kidName} fix?</b>
          <input aria-label="Note for sending back" value={note} maxLength={500} autoFocus onChange={(e) => setNote(e.target.value)} />
          <button className="p-btn" disabled={!note.trim() || sendBack.isPending}>
            Send back
          </button>
        </form>
      )}

      {run && form === 'deduct' && (
        <form
          className="pt-ded"
          onSubmit={(e) => {
            e.preventDefault()
            deduct.mutate(
              { id: run.kid_ids[0], amount: take, note: why },
              {
                onSuccess: () => {
                  setForm(null)
                  setWhy('')
                  setAmount(10)
                  setCustom('')
                },
              },
            )
          }}
        >
          <b>Deduct for {run.title}</b>
          {AMOUNTS.map((a) => (
            <button type="button" key={a} className="pt-amt" data-on={amount === a} onClick={() => setAmount(a)}>
              −{a}
            </button>
          ))}
          <input
            className="pt-amt-custom"
            inputMode="numeric"
            placeholder="Custom"
            aria-label="Custom amount"
            value={custom}
            onFocus={() => setAmount(null)}
            onChange={(e) => setCustom(e.target.value.replace(/\D/g, ''))}
          />
          <input placeholder={`Why? (${kidName} will see this)`} aria-label="Reason" value={why} maxLength={100} onChange={(e) => setWhy(e.target.value)} />
          <button className="p-btn" data-variant="red" disabled={!why.trim() || !(take > 0) || deduct.isPending}>
            Deduct
          </button>
        </form>
      )}
    </div>
  )
}
