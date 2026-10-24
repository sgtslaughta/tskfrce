import { describe, expect, test } from '@jest/globals'
import { render, screen } from '@testing-library/react'
import { NameCard } from '@/v2/flair/NameCard'
import type { Flair } from '@/v2/types'

const none: Flair = { card: null, ring: null, name: null, emblem: null, title: null }
const emblems = { 'emblem-crown': '👑' }

describe('NameCard', () => {
  test('applies the five flair classes and shows the emblem after the name', () => {
    const flair: Flair = { card: 'card-sheen', ring: 'ring-sun', name: 'name-gold', emblem: 'emblem-crown', title: 'title-mint' }
    const { container } = render(<NameCard name="Maya" avatar="🦊" level={21} title="Legend" flair={flair} emblems={emblems} />)
    const root = container.firstElementChild as HTMLElement
    expect(root).toHaveClass('flair-card', 'flair-card-sheen')
    expect(container.querySelector('.flair-ring-sun')).toBeTruthy()
    expect(container.querySelector('.flair-name-gold')).toBeTruthy()
    expect(container.querySelector('.flair-title-mint')).toHaveTextContent('Lv 21 · Legend')
    expect(screen.getByText('👑')).toBeInTheDocument()
  })

  test('null flair gives default classes only', () => {
    const { container } = render(<NameCard name="Leo" avatar="🐼" level={1} title="Rookie" flair={none} emblems={emblems} />)
    expect((container.firstElementChild as HTMLElement).className).toBe('flair-card flair-card-md')
    expect(container.querySelector('.flair-ring')!.className).toBe('flair-ring flair-ring-md')
    expect(screen.getByText('Leo').className).toBe('flair-name flair-ellipsis')
    expect(container.querySelector('.flair-title')).toHaveClass('flair-title-basic')
    expect(screen.queryByText('👑')).toBeNull()
  })

  test('long names truncate with ellipsis and keep the full name in title', () => {
    const long = 'Bartholomew-Maximilian Jr'
    render(<NameCard name={long} avatar={null} level={1} title="Rookie" flair={none} emblems={{}} />)
    const el = screen.getByTitle(long)
    expect(el).toHaveClass('flair-ellipsis')
  })

  test('renders children below', () => {
    render(<NameCard name="A" avatar={null} level={1} title="Rookie" flair={none} emblems={{}}><i>bar</i></NameCard>)
    expect(screen.getByText('bar')).toBeInTheDocument()
  })
})
