import {
  colorsTuple,
  createTheme,
  localStorageColorSchemeManager,
  virtualColor,
  type MantineThemeOverride,
} from '@mantine/core'

export const fridgeTheme: MantineThemeOverride = createTheme({
  fontFamily: 'var(--font-body), Nunito, system-ui, sans-serif',
  headings: { fontFamily: 'var(--font-display), Fredoka, system-ui, sans-serif', fontWeight: '600' },
  primaryColor: 'sun',
  autoContrast: true,
  defaultRadius: 'md',
  radius: { md: '12px', lg: '18px' },
  colors: {
    inkLight: colorsTuple('#1D2B53'),
    inkDark: colorsTuple('#F1F5FF'),
    ink: virtualColor({ name: 'ink', light: 'inkLight', dark: 'inkDark' }),
    sun: colorsTuple('#FFC93C'),
    fridgeRedLight: colorsTuple('#FF6B4A'),
    fridgeRedDark: colorsTuple('#FF7A5C'),
    fridgeRed: virtualColor({ name: 'fridgeRed', light: 'fridgeRedLight', dark: 'fridgeRedDark' }),
    fridgeGreenLight: colorsTuple('#7BD389'),
    fridgeGreenDark: colorsTuple('#6FD08A'),
    fridgeGreen: virtualColor({ name: 'fridgeGreen', light: 'fridgeGreenLight', dark: 'fridgeGreenDark' }),
  },
  components: {
    Button: { defaultProps: { className: 'f-btn' } },
  },
})

export const COLOR_SCHEME_KEY = 'task4ce-color-scheme'
/** Follows the system until the user toggles; choice saved in localStorage (Mantine wraps it in try/catch). */
export const colorSchemeManager = localStorageColorSchemeManager({ key: COLOR_SCHEME_KEY })
