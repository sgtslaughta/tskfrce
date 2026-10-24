import { describe, expect, test } from '@jest/globals'
import { render, screen } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import { WizardFrame } from '@/v2/setup/WizardFrame'

jest.mock('@/v2/parent/useLook', () => ({
  useLook: jest.fn(),
}))

const wrap = (ui: React.ReactElement) =>
  render(
    <MantineProvider>{ui}</MantineProvider>,
  )

describe('WizardFrame', () => {
  test('renders with initial step', () => {
    const onStepClick = jest.fn()
    wrap(
      <WizardFrame
        step={1}
        onNext={() => {}}
        onStepClick={onStepClick}
      >
        <div>Step 1 Content</div>
      </WizardFrame>,
    )
    expect(screen.getByText('Step 1 Content')).toBeInTheDocument()
  })

  test('displays step progress', () => {
    wrap(
      <WizardFrame
        step={2}
        onNext={() => {}}
      >
        <div>Content</div>
      </WizardFrame>,
    )
    expect(screen.getByText(/Step 2 of 7/)).toBeInTheDocument()
  })

  test('tracks maxStepReached when stepping forward', () => {
    const onStepClick = jest.fn()
    const { rerender } = render(
      <MantineProvider>
        <WizardFrame
          step={1}
          onNext={() => {}}
          onStepClick={onStepClick}
        >
          <div>Content</div>
        </WizardFrame>
      </MantineProvider>,
    )

    // Advance to step 3
    rerender(
      <MantineProvider>
        <WizardFrame
          step={3}
          onNext={() => {}}
          onStepClick={onStepClick}
        >
          <div>Content</div>
        </WizardFrame>
      </MantineProvider>,
    )

    // Should show step 3 of 7
    expect(screen.getByText(/Step 3 of 7/)).toBeInTheDocument()
  })
})
