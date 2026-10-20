/**
 * @fileoverview Theme utility functions
 * @description Helper functions for working with theme colors and variables
 * @author TaaskMaaster Team
 * @version 1.0.0
 */

import { BrandColors } from '../lib/mantine-theme';

/**
 * @description Get CSS variable names for brand colors
 */
export const getThemeColorVars = () => ({
  primary: 'var(--mantine-color-primary-filled)',
  primaryHover: 'var(--mantine-color-primary-filled-hover)',
  secondary: 'var(--mantine-color-secondary-filled)',
  secondaryHover: 'var(--mantine-color-secondary-filled-hover)',
  accent: 'var(--mantine-color-accent-filled)',
  accentHover: 'var(--mantine-color-accent-filled-hover)',
});

/**
 * @description Get Mantine color names for theme colors
 */
export const getThemeColors = () => ({
  primary: 'primary',
  secondary: 'secondary',
  accent: 'accent',
});

/**
 * @description Convert brand colors to CSS custom properties
 */
export const brandColorsToCSSVars = (brandColors: BrandColors) => {
  return {
    '--brand-primary': brandColors.primary,
    '--brand-secondary': brandColors.secondary,
    '--brand-accent': brandColors.accent,
  };
};

/**
 * @description Get brand color by name with fallback
 */
export const getBrandColor = (
  brandColors: BrandColors,
  colorName: keyof BrandColors,
  fallback?: string
): string => {
  return brandColors[colorName] || fallback || '#3B82F6';
};

/**
 * @description Predefined color palettes for easy selection
 */
export const colorPalettes = {
  blue: {
    primary: '#3B82F6',
    secondary: '#8B5CF6',
    accent: '#10B981',
  },
  green: {
    primary: '#10B981',
    secondary: '#06B6D4',
    accent: '#F59E0B',
  },
  purple: {
    primary: '#8B5CF6',
    secondary: '#EC4899',
    accent: '#F97316',
  },
  orange: {
    primary: '#F97316',
    secondary: '#EF4444',
    accent: '#84CC16',
  },
  teal: {
    primary: '#06B6D4',
    secondary: '#10B981',
    accent: '#8B5CF6',
  },
} as const;

export type ColorPaletteName = keyof typeof colorPalettes;