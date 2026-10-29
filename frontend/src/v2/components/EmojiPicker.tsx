import { useState } from 'react'
import { Popover, TextInput } from '@mantine/core'

export const EMOJIS = [
  '🦊', '🐼', '🐯', '🦁', '🐸', '🐵', '🐶', '🐱', '🐰', '🐻', '🦄', '🐉',
  '😀', '😎', '🤩', '🥳', '😺', '🤖', '👑', '🥷', '🧙', '🦸', '👽', '👻',
  '⚽', '🏀', '🏈', '🎾', '🏆', '🎮', '🎲', '🎨', '🎸', '🚀', '⭐', '🔥',
  '🍕', '🍔', '🍦', '🍩', '🍎', '🍿', '🎁', '💎', '📚', '🎬', '🚲', '💛',
]

interface Props {
  value: string
  onChange: (emoji: string) => void
  label: string
  placeholder?: string
}

/** Button showing the current emoji; opens a grid of curated emojis plus a typed fallback. */
export function EmojiPicker({ value, onChange, label, placeholder = '＋' }: Props) {
  const [open, setOpen] = useState(false)
  return (
    <div>
      <div className="pk-label">{label}</div>
      <Popover opened={open} onChange={setOpen} position="bottom-start" withArrow trapFocus>
        <Popover.Target>
          <button type="button" className="pk-pick-btn" aria-label={label} onClick={() => setOpen((o) => !o)}>
            {value || placeholder}
          </button>
        </Popover.Target>
        <Popover.Dropdown className="pk-pick-pop">
          <div className="pk-pick-grid">
            {EMOJIS.map((e) => (
              <button
                key={e}
                type="button"
                className="pk-pick-cell"
                aria-label={`Pick ${e}`}
                data-on={e === value || undefined}
                onClick={() => {
                  onChange(e)
                  setOpen(false)
                }}
              >
                {e}
              </button>
            ))}
          </div>
          <TextInput
            mt={8}
            aria-label="Other emoji"
            placeholder="Other emoji"
            maxLength={8}
            value={value}
            onChange={(ev) => onChange(ev.currentTarget.value)}
          />
        </Popover.Dropdown>
      </Popover>
    </div>
  )
}
