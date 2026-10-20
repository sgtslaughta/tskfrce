import { test, expect } from '@jest/globals';
import { readFileSync } from 'fs';
import { join } from 'path';

test('--f-on-color is a literal hex, not self-referencing', () => {
  const css = readFileSync(join(__dirname, '../../src/v2/fridge.css'), 'utf8');
  const decls = Array.from(css.matchAll(/--f-on-color:\s*([^;]+);/g)).map((m) => m[1].trim());
  expect(decls.length).toBeGreaterThan(0);
  for (const d of decls) expect(d).toMatch(/^#[0-9a-fA-F]{6}$/);
});
