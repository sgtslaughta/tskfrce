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
jest.mock('@/v2/hooks/usePreview', () => ({ useAsKid: () => null }))
jest.mock('@/v2/components/Leaderboard', () => ({ Leaderboard: () => <div>board</div> }))
jest.mock('@/v2/components/ProfileModal', () => ({ ProfileModal: () => null }))

describe('FamilySection', () => {
  it('little: sibling cards only, each sibling once, no ranking', () => {
    render(<FamilySection meId={1} little />)
    expect(screen.getAllByText('Sib')).toHaveLength(1)
    expect(screen.queryByText('board')).toBeNull()
  })
  it('other modes keep the ranking above the cards', () => {
    render(<FamilySection meId={1} />)
    expect(screen.getByText('board')).toBeTruthy()
    expect(screen.getByText('Sib')).toBeTruthy()
  })
})
