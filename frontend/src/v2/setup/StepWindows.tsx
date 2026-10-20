import { Checkbox } from '@mantine/core'

interface Props {
  bedtime: boolean
  hasKids: boolean
  onChange: (v: boolean) => void
}

export function StepWindows({ bedtime, hasKids, onChange }: Props) {
  return (
    <>
      <p>
        Choose when the internet is on. You can change this any time later.
      </p>
      <Checkbox size="md" checked={bedtime} disabled={!hasKids} onChange={(e) => onChange(e.currentTarget.checked)}
        label="Add bedtime"
        description="Internet is on every day from 7:00 am to 9:00 pm, for each kid." />
      {!hasKids && <p>Add a kid first to set a bedtime.</p>}
    </>
  )
}
