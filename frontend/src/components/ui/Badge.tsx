import { Badge as MantineBadge, BadgeProps, Indicator, IndicatorProps } from '@mantine/core';
import { forwardRef } from 'react';

// Badge wrapper
export interface CustomBadgeProps extends BadgeProps {
  // Add any custom props here
}

export const Badge = forwardRef<HTMLDivElement, CustomBadgeProps>(
  ({ children, ...props }, ref) => {
    return (
      <MantineBadge ref={ref} {...props}>
        {children}
      </MantineBadge>
    );
  }
);

Badge.displayName = 'Badge';

// Indicator wrapper for status indicators
export interface CustomIndicatorProps extends IndicatorProps {
  // Add any custom props here
}

export const CustomIndicator = forwardRef<HTMLDivElement, CustomIndicatorProps>(
  ({ children, ...props }, ref) => {
    return (
      <Indicator ref={ref} {...props}>
        {children}
      </Indicator>
    );
  }
);

CustomIndicator.displayName = 'CustomIndicator';