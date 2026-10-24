import {
  colorsTuple,
  createTheme,
  localStorageColorSchemeManager,
  virtualColor,
  type MantineThemeOverride,
} from '@mantine/core'

export const fridgeTheme: MantineThemeOverride = createTheme({
  fontFamily: 'var(--font-body), Inter, system-ui, sans-serif',
  fontFamilyMonospace: 'var(--font-mono), "JetBrains Mono", monospace',
  headings: { fontFamily: 'var(--font-display), "Space Grotesk", system-ui, sans-serif', fontWeight: '700' },
  primaryColor: 'sun',
  autoContrast: true,
  defaultRadius: 'md',
  radius: { md: '8px', lg: '8px' },
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
    Button: { classNames: { root: 'f-btn' } },
    Input: { classNames: { input: 'f-input' } },
    InputWrapper: { classNames: { label: 'f-label' } },
    SegmentedControl: { classNames: { root: 'f-seg' } },
    Switch: { classNames: { track: 'f-switch' } },
    Checkbox: { classNames: { input: 'f-check' } },
    Chip: { classNames: { label: 'f-chipctl', iconWrapper: 'f-chipicon' } },
    Menu: { classNames: { dropdown: 'f-pop', item: 'f-pop-item', divider: 'f-pop-div' } },
    Popover: { classNames: { dropdown: 'f-pop' } },
    Select: { classNames: { dropdown: 'f-pop', option: 'f-pop-item' } },
    MultiSelect: { classNames: { dropdown: 'f-pop', option: 'f-pop-item' } },
    Tooltip: { classNames: { tooltip: 'f-tip' } },
    Drawer: {
      classNames: { content: 'f-sheet', header: 'f-sheet-head', title: 'f-sheet-title', close: 'f-sheet-close', body: 'f-sheet-body', overlay: 'f-overlay' },
    },
    Modal: {
      classNames: { content: 'f-sheet', header: 'f-sheet-head', title: 'f-sheet-title', close: 'f-sheet-close', body: 'f-sheet-body', overlay: 'f-overlay' },
    },
  },
})

export const COLOR_SCHEME_KEY = 'task4ce-color-scheme'
/** Follows the system until the user toggles; choice saved in localStorage (Mantine wraps it in try/catch). */
export const colorSchemeManager = localStorageColorSchemeManager({ key: COLOR_SCHEME_KEY })
