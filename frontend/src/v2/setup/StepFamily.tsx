import { Select, TextInput } from '@mantine/core'

export const detectTz = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'

const zones = (): string[] => {
  const all = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.('timeZone') ?? []
  return Array.from(new Set([detectTz(), ...all]))
}

interface Props {
  name: string
  tz: string
  showError: boolean
  onName: (v: string) => void
  onTz: (v: string) => void
}

export function StepFamily({ name, tz, showError, onName, onTz }: Props) {
  return (
    <>
      <TextInput label="Family name" placeholder="The Smiths" value={name} onChange={(e) => onName(e.currentTarget.value)}
        error={showError && !name.trim() ? 'Enter a family name.' : undefined} />
      <Select mt="md" label="Time zone" description="We found this from your device. Change it if it's wrong."
        searchable data={zones()} value={tz} onChange={(v) => v && onTz(v)} allowDeselect={false} />
    </>
  )
}
