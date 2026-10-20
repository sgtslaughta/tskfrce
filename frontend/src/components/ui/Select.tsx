import { Select as MantineSelect, SelectProps, MultiSelect, MultiSelectProps } from '@mantine/core';
import { forwardRef } from 'react';

// Single Select wrapper
export interface CustomSelectProps extends SelectProps {
  // Add any custom props here
}

export const Select = forwardRef<HTMLInputElement, CustomSelectProps>(
  ({ ...props }, ref) => {
    return <MantineSelect ref={ref} {...props} />;
  }
);

Select.displayName = 'Select';

// Multi Select wrapper
export interface CustomMultiSelectProps extends MultiSelectProps {
  // Add any custom props here
}

export const CustomMultiSelect = forwardRef<HTMLInputElement, CustomMultiSelectProps>(
  ({ ...props }, ref) => {
    return <MultiSelect ref={ref} {...props} />;
  }
);

CustomMultiSelect.displayName = 'CustomMultiSelect';