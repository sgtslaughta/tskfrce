import { TextInput, TextInputProps, PasswordInput, PasswordInputProps, Textarea, TextareaProps } from '@mantine/core';
import { forwardRef } from 'react';

// Text Input wrapper
export interface CustomTextInputProps extends TextInputProps {
  // Add any custom props here
}

export const Input = forwardRef<HTMLInputElement, CustomTextInputProps>(
  ({ ...props }, ref) => {
    return <TextInput ref={ref} {...props} />;
  }
);

Input.displayName = 'Input';

// Password Input wrapper
export interface CustomPasswordInputProps extends PasswordInputProps {
  // Add any custom props here
}

export const CustomPasswordInput = forwardRef<HTMLInputElement, CustomPasswordInputProps>(
  ({ ...props }, ref) => {
    return <PasswordInput ref={ref} {...props} />;
  }
);

CustomPasswordInput.displayName = 'CustomPasswordInput';

// Textarea wrapper
export interface CustomTextareaProps extends TextareaProps {
  // Add any custom props here
}

export const CustomTextarea = forwardRef<HTMLTextAreaElement, CustomTextareaProps>(
  ({ ...props }, ref) => {
    return <Textarea ref={ref} {...props} />;
  }
);

CustomTextarea.displayName = 'CustomTextarea';