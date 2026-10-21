import { test, expect } from '@jest/globals';
import { readFileSync } from 'fs';
import { join } from 'path';

test('--f-on-color is a literal hex, not self-referencing', () => {
  const css = readFileSync(join(__dirname, '../../src/v2/fridge.css'), 'utf8');
  const decls = Array.from(css.matchAll(/--f-on-color:\s*([^;]+);/g)).map((m) => m[1].trim());
  expect(decls.length).toBeGreaterThan(0);
  for (const d of decls) expect(d).toMatch(/^#[0-9a-fA-F]{6}$/);
});

const css = readFileSync(join(__dirname, '../../src/v2/fridge.css'), 'utf8');
test('no fridge fonts remain', () => {
  expect(css).not.toMatch(/Fredoka|Nunito/);
});
test('dark page is charcoal and card body navy', () => {
  const dark = css.slice(css.indexOf("[data-mantine-color-scheme='dark']"));
  expect(dark).toMatch(/--f-bg:\s*#1e2026/);
  expect(dark).toMatch(/--f-card:\s*#18213f/);
});
test('tokens are not scoped to .f-shell (portals need them)', () => {
  expect(css).not.toMatch(/\.f-shell\s*\{[^}]*--f-bg:/);
});
test('page grid fades with a mask', () => {
  expect(css).toMatch(/\.f-shell::before[^}]*mask-image:\s*radial-gradient/);
});
