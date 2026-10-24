/**
 * @fileoverview Hook to manage parent/kid look switching via data-look attribute
 */

import { useEffect } from 'react';
import { accentHex, type AccentKey } from './accent';

export function useLook(look: 'parent' | 'kid', accentKey?: AccentKey | string | null): void {
  useEffect(() => {
    const html = document.documentElement;
    html.dataset.look = look;

    if (look === 'parent' && accentKey) {
      const hex = accentHex(accentKey);
      html.style.setProperty('--p-acc', hex);
      html.dataset.accent = String(accentKey);
    }
  }, [look, accentKey]);
}
