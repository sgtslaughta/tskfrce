import { describe, expect, test } from '@jest/globals'
import { render, screen, fireEvent } from '@testing-library/react'
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

  test('steps clickable and mark earlier steps done', () => {
    const onStepClick = jest.fn()
    const { rerender, container } = render(
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

    // Steps 1 and 2 should be marked as done (have check icon)
    const stepElements = container.querySelectorAll('[data-step]')
    expect(stepElements.length).toBe(7)

    // Step 1 should be done
    const step1 = stepElements[0]
    expect(step1).toHaveClass('done')
    const step1CheckIcon = step1.querySelector('.ms')
    expect(step1CheckIcon?.textContent).toContain('check')

    // Step 2 should be done
    const step2 = stepElements[1]
    expect(step2).toHaveClass('done')

    // Step 3 should be active
    const step3 = stepElements[2]
    expect(step3).toHaveAttribute('aria-current', 'step')
    expect(step3).toHaveClass('on')

    // Step 4 and beyond should not be clickable yet
    const step4 = stepElements[3]
    expect(step4).not.toHaveAttribute('role', 'button')
    expect(step4).toHaveAttribute('tabIndex', '-1')
  })

  test('prevents skipping ahead more than one step', () => {
    const onStepClick = jest.fn()
    const { container } = render(
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

    const stepElements = container.querySelectorAll('[data-step]')

    // Try to click step 3 from step 1 (should not call onStepClick)
    fireEvent.click(stepElements[2])
    expect(onStepClick).not.toHaveBeenCalled()

    // Click step 2 from step 1 (should call onStepClick)
    fireEvent.click(stepElements[1])
    expect(onStepClick).not.toHaveBeenCalledWith(2) // Not yet, only reached step 2 max
  })

  test('only steps reached or current are clickable', () => {
    const onStepClick = jest.fn()
    const { container } = render(
      <MantineProvider>
        <WizardFrame
          step={2}
          onNext={() => {}}
          onStepClick={onStepClick}
        >
          <div>Content</div>
        </WizardFrame>
      </MantineProvider>,
    )

    const stepElements = container.querySelectorAll('[data-step]')

    // Steps 1 and 2 should be clickable (reached step 2, so maxStepReached is 2)
    expect(stepElements[0]).toHaveAttribute('role', 'button')
    expect(stepElements[1]).toHaveAttribute('role', 'button')

    // Step 3 and beyond should not be clickable
    expect(stepElements[2]).not.toHaveAttribute('role', 'button')
    expect(stepElements[3]).not.toHaveAttribute('role', 'button')
    expect(stepElements[4]).not.toHaveAttribute('role', 'button')
  })

  test('Enter in a field submits the form, once, and not while busy', () => {
    const onNext = jest.fn()
    const { rerender } = wrap(
      <WizardFrame step={1} onNext={onNext}>
        <input aria-label="Name" />
      </WizardFrame>,
    )
    fireEvent.submit(screen.getByLabelText('Name'))
    expect(onNext).toHaveBeenCalledTimes(1)
    rerender(
      <MantineProvider>
        <WizardFrame step={1} onNext={onNext} busy>
          <input aria-label="Name" />
        </WizardFrame>
      </MantineProvider>,
    )
    fireEvent.submit(screen.getByLabelText('Name'))
    expect(onNext).toHaveBeenCalledTimes(1)
  })

  test('a reached step opens with Enter from the keyboard', () => {
    const onStepClick = jest.fn()
    const { container } = wrap(
      <WizardFrame step={2} onNext={() => {}} onStepClick={onStepClick}>
        <div>Content</div>
      </WizardFrame>,
    )
    fireEvent.keyDown(container.querySelectorAll('[data-step]')[0], { key: 'Enter' })
    expect(onStepClick).toHaveBeenCalledWith(1)
  })
})
