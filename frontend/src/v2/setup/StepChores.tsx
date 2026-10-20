import { Checkbox } from '@mantine/core'
import { STARTER_CHORES } from './starterChores'

interface Props {
  selected: string[]
  hasKids: boolean
  onChange: (v: string[]) => void
}

export function StepChores({ selected, hasKids, onChange }: Props) {
  return (
    <>
      <p>
        Pick the chores to start with. Each is worth 10 points and repeats every day, for every kid you added.
      </p>
      {!hasKids && <p>You haven&apos;t added any kids yet, so there is nobody to give chores to. Go back to add one, or skip this.</p>}
      <Checkbox.Group value={selected} onChange={onChange} label="Starter chores">
        <div style={{ display: 'grid', gap: 12, marginTop: 8 }}>
          {STARTER_CHORES.map((c) => <Checkbox key={c} value={c} label={c} size="md" />)}
        </div>
      </Checkbox.Group>
    </>
  )
}
