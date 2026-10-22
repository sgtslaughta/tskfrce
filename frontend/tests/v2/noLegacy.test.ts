import { describe, it, expect } from '@jest/globals'
import { readFileSync } from 'fs';
import { join } from 'path';

const read = (p: string) => readFileSync(join(__dirname, '../..', p), 'utf8');

describe('legacy app is gone', () => {
  it('_app has no NotificationProvider', () => {
    expect(read('pages/_app.tsx')).not.toContain('NotificationProvider');
  });
  it('FridgeShell nav has no /hub link', () => {
    expect(read('src/v2/components/FridgeShell.tsx')).not.toContain('/hub');
  });
});
