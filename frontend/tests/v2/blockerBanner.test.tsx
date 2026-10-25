import { expect, test } from '@jest/globals'
import { render, screen } from '@testing-library/react'
import { BlockerBanner } from '@/v2/components/BlockerBanner'

jest.mock('@/v2/hooks/useDevices', () => ({ useBlocker: () => ({ data: { online: false, last_seen: null } }) }))

test('offline banner reads as plain text (no HTML entities)', () => {
  render(<BlockerBanner />)
  expect(screen.getByRole('alert')).toHaveTextContent('Hasn’t checked in yet.')
  expect(screen.getByRole('alert').textContent).not.toContain('&apos;')
})
