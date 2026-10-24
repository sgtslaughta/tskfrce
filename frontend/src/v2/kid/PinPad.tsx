import { useEffect, useRef, useState } from 'react'
import { Button } from '@mantine/core'

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
    <div role="group" aria-label="PIN" style={{ display: 'grid', gap: 14, justifyItems: 'center' }}>
      <div aria-hidden style={{ display: 'flex', gap: 14, fontSize: 36, minHeight: 44 }}>
        {[0, 1, 2, 3].map((i) => (
          <span key={i}>{i < pin.length ? '●' : '○'}</span>
        ))}
      </div>
      <span aria-live="polite" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
        {pin.length ? `${pin.length} of 4 digits` : ''}
      </span>
      <p role="alert" style={{ margin: 0, minHeight: 24, fontWeight: 700 }}>
        {error ?? ''}
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(64px, 88px))', gap: 10 }}>
        {KEYS.map((k, i) =>
          k ? (
            <Button
              key={i}
              variant={k === '⌫' ? 'default' : 'filled'}
              aria-label={k === '⌫' ? 'Delete' : k}
              onClick={() => press(k)}
              style={{ height: 72, fontSize: 28 }}
            >
              {k}
            </Button>
          ) : (
            <span key={i} />
          ),
        )}
      </div>
    </div>
  )
}
