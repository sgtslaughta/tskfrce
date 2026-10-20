// Temporary compatibility layer for design-system imports
// Simple classname utility
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}
