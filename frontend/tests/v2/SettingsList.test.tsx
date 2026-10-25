import { describe, expect, test } from '@jest/globals'
import { render, screen } from '@testing-library/react'
import { SettingsList } from '@/v2/manage/SettingsList'

const sections = [
  { id: 'family', label: 'Family', description: 'Name, time zone', icon: 'home' },
  { id: 'hours', label: 'Hours', description: 'School nights', icon: 'schedule' },
]

describe('SettingsList', () => {
  test('each section links to ?section= with its one-line description; the open one is current', () => {
    render(<SettingsList sections={sections} section="hours" />)
    const hours = screen.getByRole('link', { name: /Hours/ })
    expect(hours).toHaveAttribute('href', '/settings?section=hours')
    expect(hours).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: /Family/ })).not.toHaveAttribute('aria-current')
    expect(screen.getByText('Name, time zone')).toBeInTheDocument()
  })

  test('on the phone list nothing is marked current', () => {
    render(<SettingsList sections={sections} />)
    expect(screen.queryByRole('link', { current: 'page' })).toBeNull()
  })
})
