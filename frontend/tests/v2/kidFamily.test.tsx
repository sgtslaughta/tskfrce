import { render, screen } from '@testing-library/react'
import { FamilySection } from '@/v2/kid/FamilySection'

jest.mock('@/v2/hooks/useCommunity', () => ({
  useLeaderboard: () => ({ data: { rows: [
    { kid_id: 1, name: 'Me', avatar: 'a', score: 5, level: 1, title: 'Rookie', rank: 1 },
    { kid_id: 2, name: 'Sib', avatar: 'b', score: 3, level: 2, title: 'Pro', rank: 2 },
  ] } }),
  useProfiles: () => ({ data: [
    { kid_id: 1, name: 'Me', avatar: 'a', level: 1, title: 'Rookie' },
    { kid_id: 2, name: 'Sib', avatar: 'b', level: 2, title: 'Pro' },
  ] }),
}))
jest.mock('@/v2/hooks/useEmblems', () => ({ useEmblems: () => ({}) }))
jest.mock('@/v2/hooks/usePreview', () => ({ useAsKid: () => null }))
jest.mock('@/v2/components/Leaderboard', () => ({ Leaderboard: ({ rows }: { rows: { name: string }[] }) => <div>{rows.map((r) => <span key={r.name}>{r.name}</span>)}</div> }))
jest.mock('@/v2/components/ProfileModal', () => ({ ProfileModal: () => null }))

describe('FamilySection', () => {
  it('little: sibling cards only, each sibling once, no ranking', () => {
    render(<FamilySection meId={1} little />)
    expect(screen.getAllByText('Sib')).toHaveLength(1)
    expect(screen.queryByText('Me')).toBeNull()
    expect(screen.getByRole('button', { name: /Sib.*open profile/ })).toBeInTheDocument()
  })
  it('kid/teen: one ranking row per member, no extra sibling list', () => {
    render(<FamilySection meId={1} />)
    expect(screen.getAllByText('Sib')).toHaveLength(1)
    expect(screen.queryByRole('button', { name: /Sib/ })).toBeNull()
  })
})
