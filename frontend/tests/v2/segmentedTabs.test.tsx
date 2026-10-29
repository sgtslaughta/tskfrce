import { expect, test } from '@jest/globals'
import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SegmentedControl } from '@/v2/parent/SegmentedControl'

const opts = [
  { value: 'a', label: 'One' },
  { value: 'b', label: 'Two' },
  { value: 'c', label: 'Three' },
]
function Host({ tabs }: { tabs?: string }) {
  const [v, setV] = useState('a')
  return <SegmentedControl value={v} onChange={setV} options={opts} label="Things" tabs={tabs} />
}

test('tabs mode is a tablist with roving tabindex and arrow keys', async () => {
  render(<Host tabs="t" />)
  expect(screen.getByRole('tablist', { name: 'Things' })).toBeTruthy()
  const [one, two, three] = screen.getAllByRole('tab')
  expect(one.getAttribute('aria-selected')).toBe('true')
  expect(one.getAttribute('aria-controls')).toBe('t-panel-a')
  expect(two.tabIndex).toBe(-1)
  one.focus()
  await userEvent.keyboard('{ArrowRight}')
  expect(two.getAttribute('aria-selected')).toBe('true')
  expect(document.activeElement).toBe(two)
  await userEvent.keyboard('{End}')
  expect(document.activeElement).toBe(three)
  await userEvent.keyboard('{ArrowRight}')
  expect(document.activeElement).toBe(one)
  await userEvent.keyboard('{ArrowLeft}')
  expect(document.activeElement).toBe(three)
  await userEvent.keyboard('{Home}')
  expect(document.activeElement).toBe(one)
})

test('default mode keeps the pressed-button group', () => {
  render(<Host />)
  expect(screen.getByRole('group', { name: 'Things' })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'One' }).getAttribute('aria-pressed')).toBe('true')
})
