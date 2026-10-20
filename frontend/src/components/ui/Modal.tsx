import { Modal as MantineModal, ModalProps } from '@mantine/core';
import { forwardRef } from 'react';

export interface CustomModalProps extends ModalProps {
  // Add any custom props here
}

export const Modal = forwardRef<HTMLDivElement, CustomModalProps>(
  ({ children, ...props }, ref) => {
    return (
      <MantineModal ref={ref} {...props}>
        {children}
      </MantineModal>
    );
  }
);

Modal.displayName = 'Modal';