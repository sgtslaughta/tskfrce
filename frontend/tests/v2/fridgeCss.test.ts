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

test('cards have no outline and 8px corners', () => {
  const card = css.match(/\.f-card\s*\{[^}]*\}/)![0];
  expect(card).not.toMatch(/border:\s*3px/);
  expect(card).toMatch(/border-radius:\s*8px/);
  expect(card).toMatch(/box-shadow:\s*var\(--f-shadow\)/);
});
test('card head uses head tokens and dark stripe', () => {
  const head = css.match(/\.f-card-head\s*\{[^}]*\}/)![0];
  expect(head).toMatch(/background:\s*var\(--f-head-bg\)/);
  expect(head).toMatch(/color:\s*var\(--f-head-ink\)/);
  expect(head).toMatch(/border-top:\s*4px solid var\(--f-head-stripe\)/);
});
test('sticker tag no longer rotates', () => {
  expect(css).not.toMatch(/rotate\(-2deg\)/);
});
