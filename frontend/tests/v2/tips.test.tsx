import { describe, expect, test, beforeEach } from '@jest/globals'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { QuickTip } from '@/v2/components/QuickTip'
import { InfoBlock } from '@/v2/components/InfoBlock'

jest.mock('@/v2/hooks/useTips')

const wrap = (ui: React.ReactElement) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      {ui}
    </QueryClientProvider>,
  )

describe('QuickTip', () => {
  beforeEach(() => {
    const { useDismissTip } = require('@/v2/hooks/useTips')
    useDismissTip.mockReturnValue({
      mutate: jest.fn(),
    })
  })

  test('renders tip with icon and text', () => {
    wrap(<QuickTip tipKey="test.tip" icon="info" text="This is a test tip" />)
    expect(screen.getByText('This is a test tip')).toBeInTheDocument()
    expect(screen.getByLabelText('Dismiss tip')).toBeInTheDocument()
  })

  test('renders in parent mode by default', () => {
    wrap(<QuickTip tipKey="test.tip" icon="info" text="Test" />)
    const tip = screen.getByRole('status')
    expect(tip.className).toMatch(/parentMode/)
  })

  test('renders in kid mode when kidMode is true', () => {
    wrap(<QuickTip tipKey="test.tip" icon="info" text="Test" kidMode />)
    const tip = screen.getByRole('status')
    expect(tip.className).toMatch(/kidMode/)
  })
})

describe('InfoBlock', () => {
  test('renders info block with icon and text', () => {
    wrap(<InfoBlock icon="info" text="This is information" />)
    expect(screen.getByText('This is information')).toBeInTheDocument()
  })

  test('renders children if provided', () => {
    wrap(
      <InfoBlock icon="info" text="Title">
        <p>Additional content</p>
      </InfoBlock>,
    )
    expect(screen.getByText('Additional content')).toBeInTheDocument()
  })

  test('renders in parent mode by default', () => {
    wrap(<InfoBlock icon="info" text="Test" />)
    const block = screen.getByRole('region')
    expect(block.className).toMatch(/parentMode/)
  })

  test('renders in kid mode when kidMode is true', () => {
    wrap(<InfoBlock icon="info" text="Test" kidMode />)
    const block = screen.getByRole('region')
    expect(block.className).toMatch(/kidMode/)
  })
})
