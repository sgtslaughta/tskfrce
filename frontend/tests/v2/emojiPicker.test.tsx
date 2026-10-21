import { describe, expect, test } from '@jest/globals'
import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MantineProvider } from '@mantine/core'
import { fridgeTheme } from '@/v2/theme'
import { EmojiPicker } from '@/v2/components/EmojiPicker'

function Harness({ onChange }: { onChange: (e: string) => void }) {
  const [v, setV] = useState('')
  return (
    <MantineProvider theme={fridgeTheme}>
      <EmojiPicker
        label="Avatar"
        value={v}
        onChange={(e) => {
          setV(e)
          onChange(e)
        }}
      />
    </MantineProvider>
  )
}

describe('EmojiPicker', () => {
  test('selecting a grid emoji calls onChange and shows it', async () => {
    const fn = jest.fn()
    render(<Harness onChange={fn} />)
    await userEvent.click(screen.getByRole('button', { name: 'Avatar' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Pick 🦄' }))
    expect(fn).toHaveBeenCalledWith('🦄')
    expect(screen.getByRole('button', { name: 'Avatar' })).toHaveTextContent('🦄')
  })

  test('typed fallback calls onChange', async () => {
    const fn = jest.fn()
    render(<Harness onChange={fn} />)
    await userEvent.click(screen.getByRole('button', { name: 'Avatar' }))
    await userEvent.type(await screen.findByLabelText('Other emoji'), '🧁')
    expect(fn).toHaveBeenLastCalledWith('🧁')
  })
})
