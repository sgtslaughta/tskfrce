import { Card as MantineCard, CardProps, CardSection } from '@mantine/core';
import { forwardRef } from 'react';

export interface CustomCardProps extends CardProps {
  // Add any custom props here
}

export const Card = forwardRef<HTMLDivElement, CustomCardProps>(
  ({ children, ...props }, ref) => {
    return (
      <MantineCard ref={ref} {...props}>
        {children}
      </MantineCard>
    );
  }
);

Card.displayName = 'Card';

// Re-export CardSection for convenience
export { CardSection };