import { useState } from 'react'
import { Modal } from '@mantine/core'
import { Icon } from '@/v2/parent/Icon'
import { usePatchFamily } from '@/v2/hooks/useFamily'
import { toastFail, toastOk } from '@/v2/notify'

const MAX = 8
const LEN = 60

/** Family quick replies: reorder, edit, remove, add (max 8, each up to 60 characters). */
export function QuickRepliesEditor({ replies, onClose }: { replies: string[]; onClose: () => void }) {
  const [list, setList] = useState(replies)
  const [add, setAdd] = useState('')
  const patch = usePatchFamily()
  const move = (i: number, d: -1 | 1) => {
    const next = [...list]
    ;[next[i], next[i + d]] = [next[i + d], next[i]]
    setList(next)
  }
  const addOne = () => {
    if (!add.trim() || list.length >= MAX) return
    setList([...list, add.trim()])
    setAdd('')
  }
  const clean = list.map((r) => r.trim())

  return (
    <Modal opened onClose={onClose} title="Quick replies" centered zIndex={400} styles={{ title: { fontWeight: 700, color: 'var(--p-ink)' } }}>
      <ul className="pc-qre">
        {list.map((r, i) => (
          <li key={i}>
            <input
              className="pk-input"
              aria-label={`Reply ${i + 1}`}
              value={r}
              maxLength={LEN}
              onChange={(e) => setList(list.map((x, j) => (j === i ? e.target.value : x)))}
            />
            <button type="button" className="pc-ib" aria-label={`Move “${r}” up`} title="Move up" disabled={i === 0} onClick={() => move(i, -1)}>
              <Icon name="arrow_upward" size={18} />
            </button>
            <button type="button" className="pc-ib" aria-label={`Move “${r}” down`} title="Move down" disabled={i === list.length - 1} onClick={() => move(i, 1)}>
              <Icon name="arrow_downward" size={18} />
            </button>
            <button type="button" className="pc-ib" aria-label={`Remove “${r}”`} title="Remove" onClick={() => setList(list.filter((_, j) => j !== i))}>
              <Icon name="close" size={18} />
            </button>
          </li>
        ))}
      </ul>
      <form
        className="pc-qre-add"
        onSubmit={(e) => {
          e.preventDefault()
          addOne()
        }}
      >
        <input
          className="pk-input"
          aria-label="New reply"
          placeholder={list.length >= MAX ? `Up to ${MAX} replies` : 'Add a reply'}
          value={add}
          maxLength={LEN}
          disabled={list.length >= MAX}
          onChange={(e) => setAdd(e.target.value)}
        />
        <button type="submit" className="p-btn" disabled={!add.trim() || list.length >= MAX}>
          <Icon name="add" size={17} />
          Add
        </button>
      </form>
      <div className="pk-actions">
        <button type="button" className="p-btn" onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          className="p-btn"
          data-variant="accent"
          disabled={clean.some((r) => !r) || patch.isPending}
          onClick={() =>
            patch.mutate(
              { quick_replies: clean },
              {
                onSuccess: () => {
                  toastOk('Saved')
                  onClose()
                },
                onError: toastFail,
              },
            )
          }
        >
          <Icon name="check" size={17} />
          Save
        </button>
      </div>
    </Modal>
  )
}
