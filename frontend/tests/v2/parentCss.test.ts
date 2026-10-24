import { test, expect } from '@jest/globals';
import { readFileSync } from 'fs';
import { join } from 'path';

const css = readFileSync(join(__dirname, '../../src/v2/parent/parent.css'), 'utf8');

// WCAG contrast helper: relative luminance calc
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

test('light and dark parent tokens match spec 2.2', () => {
  expect(css).toMatch(/\[data-look='parent'\][^{]*\{[^}]*--p-bg:\s*#f8f8f8/);
  const dark = css.slice(css.indexOf("[data-mantine-color-scheme='dark']"));
  expect(dark).toMatch(/--p-bg:\s*#1c1c1b/);
  expect(dark).toMatch(/--p-card:\s*#292928/);
});

test('light meters are ink on #e4e4e1, dark meters use accent', () => {
  const light = css.slice(0, css.indexOf("[data-mantine-color-scheme='dark']"));
  expect(light).toMatch(/--p-meter:\s*#292928/);
  expect(light).toMatch(/--p-track:\s*#e4e4e1/);

  const dark = css.slice(css.indexOf("[data-mantine-color-scheme='dark']"));
  expect(dark).toMatch(/--p-meter:\s*var\(--p-acc\)/);
  expect(dark).toMatch(/--p-track:\s*#3d3d3b/);
});

test('toast uses inverse surface in both schemes', () => {
  const light = css.slice(0, css.indexOf("[data-mantine-color-scheme='dark']"));
  expect(light).toMatch(/--p-tbg:\s*#292928/);

  const dark = css.slice(css.indexOf("[data-mantine-color-scheme='dark']"));
  expect(dark).toMatch(/--p-tbg:\s*#f4f4f2/);
});

test('fridge tokens untouched', () => {
  const fridge = readFileSync(join(__dirname, '../../src/v2/fridge.css'), 'utf8');
  expect(fridge).toMatch(/--f-bg:\s*#f4f7fa/);
});

test('lilac outlines needs-ok', () => {
  expect(css).toMatch(/\[data-accent='lilac'\][^{]*\.p-chip\[data-tone='lav'\][^{]*\{[^}]*background:\s*transparent/);
});
