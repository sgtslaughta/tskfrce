import { expect, test } from '@jest/globals'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { KidStrip } from '@/v2/today/KidStrip'
import type { TodayKid } from '@/v2/types'

jest.mock('next/link', () => ({ children, href, ...p }: any) => <a href={href} {...p}>{children}</a>)

const k = (id: number, name: string, extra: Partial<TodayKid>): TodayKid =>
  ({ id, name, avatar: null, online_all: false, chores: [], devices: [], ...extra }) as TodayKid

test('waiting count, all-done tick, selection and Add', async () => {
  const pick = jest.fn()
  render(
    <KidStrip
      kids={[k(1, 'Mia', { needs_you_count: 2, done: 3, total: 5 }), k(2, 'Ava', { done: 5, total: 5 })]}
      selected={1}
      onSelect={pick}
    />,
  )
  const mia = screen.getByRole('button', { name: /mia/i })
  expect(mia).toHaveAttribute('aria-pressed', 'true')
  expect(mia).toHaveTextContent('M2')
  expect(screen.getByRole('button', { name: /ava/i })).toHaveTextContent('check')
  await userEvent.click(screen.getByRole('button', { name: /ava/i }))
  expect(pick).toHaveBeenCalledWith(expect.objectContaining({ id: 2 }))
  expect(screen.getByRole('link', { name: /add/i })).toHaveAttribute('href', '/kids?section=kids')
})
