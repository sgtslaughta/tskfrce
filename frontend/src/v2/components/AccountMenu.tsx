import Link from 'next/link'
import { Menu } from '@mantine/core'

export const HELP_URL = 'https://sgtslaughta.github.io/tskfrce/guide/?from=app'

/** Top-bar account button: name and initial open Help, Settings and Log out. */
export function AccountMenu({ name, onLogout }: { name: string; onLogout: () => void }) {
  return (
    <Menu position="bottom-end" width={200} withinPortal>
      <Menu.Target>
        <button type="button" className="f-acct" aria-label={`Account menu for ${name}`}>
          <span className="f-acct-dot" aria-hidden="true">
            {name.charAt(0).toUpperCase()}
          </span>
          <span className="f-acct-name">{name}</span>
        </button>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Item component="a" href={HELP_URL}>
          Help
        </Menu.Item>
        <Menu.Item component={Link} href="/settings">
          Settings
        </Menu.Item>
        <Menu.Divider />
        <Menu.Item onClick={onLogout}>Log out</Menu.Item>
      </Menu.Dropdown>
    </Menu>
  )
}
