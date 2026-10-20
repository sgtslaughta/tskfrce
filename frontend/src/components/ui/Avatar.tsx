import { Avatar as MantineAvatar, AvatarProps, AvatarGroup } from '@mantine/core';
import { forwardRef } from 'react';

// Avatar wrapper
export interface CustomAvatarProps extends AvatarProps {
  // Add any custom props here
}

export const Avatar = forwardRef<HTMLDivElement, CustomAvatarProps>(
  ({ ...props }, ref) => {
    return <MantineAvatar ref={ref} {...props} />;
  }
);

Avatar.displayName = 'Avatar';

// Re-export AvatarGroup for convenience
export { AvatarGroup };