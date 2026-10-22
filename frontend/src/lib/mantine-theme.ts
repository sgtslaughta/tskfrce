/**
 * @fileoverview Mantine theme built from three brand colors.
 * Minimal defaults; restyled in Plan 3.
 */

import { createTheme, MantineColorsTuple, MantineThemeOverride } from '@mantine/core';
import type { BrandColors } from '../utils/cookies';

export type { BrandColors };

export const defaultBrandColors: BrandColors = {
  primary: '#228be6',
  secondary: '#7950f2',
  accent: '#fd7e14',
};

/** Mix a #rrggbb color toward white (t < 0) or black (t > 0). */
const mix = (hex: string, t: number): string => {
  const n = parseInt(hex.replace('#', '').padEnd(6, '0').slice(0, 6), 16);
  const target = t < 0 ? 255 : 0;
  const ch = (shift: number) => {
    const c = (n >> shift) & 255;
    return Math.round(c + (target - c) * Math.abs(t)).toString(16).padStart(2, '0');
  };
  return `#${ch(16)}${ch(8)}${ch(0)}`;
};

/** Ten shades, lightest to darkest, with the brand color at index 6. */
const shades = (hex: string): MantineColorsTuple =>
  [-0.9, -0.75, -0.6, -0.45, -0.3, -0.15, 0, 0.15, 0.3, 0.45].map((t) =>
    mix(hex, t)
  ) as unknown as MantineColorsTuple;

export const createMantineTheme = (
  colors: BrandColors = defaultBrandColors
): MantineThemeOverride =>
  createTheme({
    primaryColor: 'primary',
    colors: {
      primary: shades(colors.primary),
      secondary: shades(colors.secondary),
      accent: shades(colors.accent),
    },
  });

export const mantineTheme = createMantineTheme();
