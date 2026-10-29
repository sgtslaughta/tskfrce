import Link from 'next/link'
import { Icon } from '@/v2/parent/Icon'
import { ListHeader } from '@/v2/parent/ListHeader'

export interface SettingsSection<S extends string = string> {
  id: S
  label: string
  description: string
  icon: string
}

/** Settings list column: one card per section (icon tile, name, one-liner, chevron). `bare`: the page header already names it. */
export function SettingsList<S extends string>({ sections, section, bare }: { sections: SettingsSection<S>[]; section?: S; bare?: boolean }) {
  return (
    <>
      {!bare && <ListHeader title="Settings" />}
      <nav className="pk-items" aria-label="Settings sections">
        {sections.map((s) => (
          <Link
            key={s.id}
            href={`/settings?section=${s.id}`}
            className="pk-card ps-card"
            data-selected={section === s.id}
            aria-current={section === s.id ? 'page' : undefined}
          >
            <span className="pk-tile" aria-hidden="true">
              <Icon name={s.icon} size={20} />
            </span>
            <span className="pk-card-t">
              <b>{s.label}</b>
              <small>{s.description}</small>
            </span>
            <span className="ps-chev" aria-hidden="true">
              <Icon name="chevron_right" size={20} />
            </span>
          </Link>
        ))}
      </nav>
    </>
  )
}
