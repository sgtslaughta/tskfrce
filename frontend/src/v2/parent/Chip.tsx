import { ReactNode } from 'react';
import { Icon } from './Icon';

export type ChipTone = 'acc' | 'lav' | 'grey' | 'amb' | 'red' | 'ink';

interface ChipProps {
  tone: ChipTone;
  icon: string;
  children: ReactNode;
  className?: string;
}

/**
 * Parent chip: always icon + text with a tonal background.
 * Used in headers, lists, and status indicators.
 */
export function Chip({ tone, icon, children, className = '' }: ChipProps) {
  return (
    <span className={`p-chip ${className}`} data-tone={tone}>
      <Icon name={icon} size={16} />
      {children}
    </span>
  );
}
