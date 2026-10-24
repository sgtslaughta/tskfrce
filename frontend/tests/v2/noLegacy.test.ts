import { describe, it, expect } from '@jest/globals'
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const read = (p: string) => readFileSync(join(__dirname, '../..', p), 'utf8');
const exists = (p: string) => existsSync(join(__dirname, '../..', p));

describe('legacy app is gone', () => {
  it('_app has no NotificationProvider', () => {
    expect(read('pages/_app.tsx')).not.toContain('NotificationProvider');
  });
  it('FridgeShell has been deleted', () => {
    expect(exists('src/v2/components/FridgeShell.tsx')).toBe(false);
  });
});
