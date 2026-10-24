import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { renderHook, act } from '@testing-library/react';
import { readFileSync } from 'fs';
import { join } from 'path';
import { useLook } from '@/v2/parent/useLook';
import { accentHex, ACCENTS } from '@/v2/parent/accent';

// WCAG contrast helper
function getLuminance(hex: string): number {
  const [, r, g, b] = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex) || [];
  if (!r) return 0.5;
  const [rs, gs, bs] = [parseInt(r, 16), parseInt(g, 16), parseInt(b, 16)].map(c => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function contrast(hex1: string, hex2: string): number {
  const l1 = getLuminance(hex1);
  const l2 = getLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

const tokensCss = readFileSync(join(__dirname, '../../src/v2/parent/parent-tokens.css'), 'utf8');
const choreCss = readFileSync(join(__dirname, '../../src/v2/parent/parent-chore.css'), 'utf8');
const css = tokensCss + '\n' + choreCss;

describe('useLook', () => {
  beforeEach(() => {
    // Clear data-look attribute before each test
    document.documentElement.removeAttribute('data-look');
  });

  afterEach(() => {
    document.documentElement.removeAttribute('data-look');
  });

  test('unknown accent falls back to neon', () => {
    expect(accentHex('purple')).toBe('#c3f832');
    expect(accentHex(null)).toBe('#c3f832');
    expect(accentHex(undefined)).toBe('#c3f832');
  });

  test('all ten accents keep >= 7:1 with #292928', () => {
    for (const a of Object.values(ACCENTS)) {
      const c = contrast(a.hex, '#292928');
      expect(c).toBeGreaterThanOrEqual(7);
    }
  });

  test('look attribute follows the route', () => {
    const { rerender } = renderHook(({ l }) => useLook(l), { initialProps: { l: 'parent' as const } });
    expect(document.documentElement.dataset.look).toBe('parent');

    act(() => {
      rerender({ l: 'kid' });
    });
    expect(document.documentElement.dataset.look).toBe('kid');
  });

  test('lilac outlines needs-ok', () => {
    expect(css).toMatch(/\[data-accent='lilac'\][^{]*\.p-chip\[data-tone='lav'\][^{]*\{[^}]*background:\s*transparent/);
  });

  test('all ACCENTS keys are defined', () => {
    const expectedKeys = ['neon', 'sun', 'tangerine', 'bubblegum', 'lilac', 'sky', 'aqua', 'mint', 'peach', 'ice'];
    for (const key of expectedKeys) {
      expect(ACCENTS).toHaveProperty(key);
      expect(ACCENTS[key as keyof typeof ACCENTS]).toHaveProperty('name');
      expect(ACCENTS[key as keyof typeof ACCENTS]).toHaveProperty('hex');
    }
  });
});
