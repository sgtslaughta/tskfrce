import { Progress as MantineProgress, ProgressProps, RingProgress, RingProgressProps } from '@mantine/core';
import { forwardRef } from 'react';

// Linear Progress wrapper
export interface CustomProgressProps extends ProgressProps {
  // Add any custom props here
}

export const Progress = forwardRef<HTMLDivElement, CustomProgressProps>(
  ({ ...props }, ref) => {
    return <MantineProgress ref={ref} {...props} />;
  }
);

Progress.displayName = 'Progress';

// Ring Progress wrapper
export interface CustomRingProgressProps extends RingProgressProps {
  // Add any custom props here
}

export const CustomRingProgress = forwardRef<HTMLDivElement, CustomRingProgressProps>(
  ({ ...props }, ref) => {
    return <RingProgress ref={ref} {...props} />;
  }
);

CustomRingProgress.displayName = 'CustomRingProgress';