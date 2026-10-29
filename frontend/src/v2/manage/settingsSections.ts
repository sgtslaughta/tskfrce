import type { SettingsSection } from './SettingsList'

export type S = 'family' | 'hours' | 'notifications' | 'look' | 'gifs' | 'parents'

/** The settings sections (spec mockup 02): one list for the Settings page and the phone More page. */
export const SETTINGS_SECTIONS: SettingsSection<S>[] = [
  { id: 'family', label: 'Family', description: 'Name, time zone, points rules', icon: 'home' },
  { id: 'hours', label: 'Hours', description: 'School nights, weekends', icon: 'schedule' },
  { id: 'notifications', label: 'Notifications', description: 'Chat app pings, quiet hours, kid phones', icon: 'notifications' },
  { id: 'look', label: 'Appearance', description: 'Accent colour, dark mode', icon: 'palette' },
  { id: 'gifs', label: 'GIFs', description: 'Chat GIF search', icon: 'gif_box' },
  { id: 'parents', label: 'Parents', description: 'Invite and manage parents', icon: 'supervisor_account' },
]
