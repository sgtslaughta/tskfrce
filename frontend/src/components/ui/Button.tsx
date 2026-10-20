import { Button as MantineButton, ButtonProps } from '@mantine/core';
import { forwardRef } from 'react';

export interface CustomButtonProps extends ButtonProps {
  // Add any custom props here
}

export const Button = forwardRef<HTMLButtonElement, CustomButtonProps>(
  ({ children, ...props }, ref) => {
    return (
      <MantineButton ref={ref} {...props}>
        {children}
      </MantineButton>
    );
  }
);

Button.displayName = 'Button';