import { ActionIcon, useComputedColorScheme, useMantineColorScheme } from '@mantine/core'

/** Light/dark switch. Mantine's manager saves the choice under task4ce-color-scheme. */
export function ColorSchemeToggle() {
  const { setColorScheme } = useMantineColorScheme()
  const dark = useComputedColorScheme('light', { getInitialValueInEffect: true }) === 'dark'
  return (
    <ActionIcon
      variant="subtle"
      color="ink"
      size={44}
      radius="md"
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      onClick={() => setColorScheme(dark ? 'light' : 'dark')}
    >
      <span aria-hidden="true" style={{ fontSize: 22 }}>
        {dark ? '☀️' : '🌙'}
      </span>
    </ActionIcon>
  )
}
