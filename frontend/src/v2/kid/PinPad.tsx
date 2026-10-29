import { useEffect, useRef, useState } from 'react'
import { Icon } from '@/v2/parent/Icon'

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫']

/** 4-digit PIN entry: big keys plus keyboard. Auto-submits at 4 digits. */
export function PinPad({
  onSubmit,
  error,
  busy,
}: {
  onSubmit: (pin: string) => void
  error?: string | null
  busy?: boolean
}) {
  const [pin, setPin] = useState('')
  const submit = useRef(onSubmit)
  submit.current = onSubmit

  const press = (k: string) => {
    if (busy) return
    setPin((p) => (k === '⌫' ? p.slice(0, -1) : p.length < 4 ? p + k : p))
  }
  // keyboard support
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      if (/^\d$/.test(e.key)) press(e.key)
      else if (e.key === 'Backspace') press('⌫')
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  })
  // submit when full; wipe so a wrong PIN can be retyped
  useEffect(() => {
    if (pin.length === 4) {
      submit.current(pin)
      setPin('')
    }
  }, [pin])

  return (
    <div role="group" aria-label="PIN" className="k-pin">
      <div aria-hidden className="kg-dots">
        {[0, 1, 2, 3].map((i) => (
          <i key={i} data-on={i < pin.length || undefined} />
        ))}
      </div>
      <span aria-live="polite" className="k-sr">
        {pin.length ? `${pin.length} of 4 digits` : ''}
      </span>
      <p role="alert" className="k-pin-err">
        {error ?? ''}
      </p>
      <div className="k-keys">
        {KEYS.map((k, i) =>
          k ? (
            <button
              key={i}
              type="button"
              className="k-key"
              data-del={k === '⌫' || undefined}
              aria-label={k === '⌫' ? 'Delete' : k}
              disabled={busy}
              onClick={() => press(k)}
            >
              {k === '⌫' ? <Icon name="backspace" /> : k}
            </button>
          ) : (
            <span key={i} />
          ),
        )}
      </div>
    </div>
  )
}
