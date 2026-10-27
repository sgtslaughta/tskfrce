import { KeyboardEvent, ReactNode } from 'react'

interface SegmentedControlProps<T extends string> {
  value: T
  onChange: (value: T) => void
  options: Array<{ value: T; label: ReactNode }>
  /** Accessible name of the group. */
  label?: string
  /** Tab mode: an ARIA tablist with this id prefix (see `tabIds`). Selecting follows focus. */
  tabs?: string
}

/** Ids a tab and its panel share, for aria-controls / aria-labelledby. */
export const tabIds = (prefix: string, value: string) => ({ tab: `${prefix}-tab-${value}`, panel: `${prefix}-panel-${value}` })

export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  label,
  tabs,
}: SegmentedControlProps<T>) {
  const onKeys = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = options.findIndex((o) => o.value === value)
    const next = { ArrowRight: (i + 1) % options.length, ArrowLeft: (i - 1 + options.length) % options.length, Home: 0, End: options.length - 1 }[e.key]
    if (next === undefined) return
    e.preventDefault()
    onChange(options[next].value)
    e.currentTarget.querySelectorAll<HTMLElement>('[role="tab"]')[next]?.focus()
  }
  return (
    <div className="p-segmented-control" role={tabs ? 'tablist' : 'group'} aria-label={label} onKeyDown={tabs ? onKeys : undefined}>
      {options.map((option) => {
        const on = value === option.value
        const ids = tabs ? tabIds(tabs, option.value) : null
        return (
          <button
            key={option.value}
            type="button"
            className="p-segmented-button"
            data-active={on}
            onClick={() => onChange(option.value)}
            {...(ids
              ? { role: 'tab', id: ids.tab, 'aria-selected': on, 'aria-controls': ids.panel, tabIndex: on ? 0 : -1 }
              : { 'aria-pressed': on })}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
