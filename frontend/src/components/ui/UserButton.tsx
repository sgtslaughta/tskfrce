/**
 * @fileoverview UserButton Component
 * @description A user profile button component following Mantine's design patterns
 * @author TaaskMaaster Team
 * @version 1.0.0
 */

import React, { forwardRef } from 'react';
import { Avatar, Group, Text, UnstyledButton, Box } from '@mantine/core';
import { IconChevronDown } from '@tabler/icons-react';

interface UserButtonProps {
  /** User information */
  user: {
    id: string;
    username: string;
    email: string;
    role?: string;
    points?: number;
    level?: number;
    avatar?: string;
  };
  /** Click handler */
  onClick?: () => void;
  /** Whether to show chevron icon */
  withChevron?: boolean;
  /** Component size */
  size?: 'xs' | 'sm' | 'md' | 'lg';
  /** Custom styles */
  style?: React.CSSProperties;
  /** Custom className */
  className?: string;
  /** Show compact layout (avatar only with tooltip on hover) */
  compact?: boolean;
}

export const UserButton = forwardRef<HTMLButtonElement, UserButtonProps>(({
  user,
  onClick,
  withChevron = true,
  size = 'sm',
  style,
  className,
  compact = false
}, ref) => {
  const avatarSize = {
    xs: 24,
    sm: 32,
    md: 40,
    lg: 48
  }[size];

  const textSize = {
    xs: 'xs',
    sm: 'sm',
    md: 'md',
    lg: 'lg'
  }[size] as any;

  const detailTextSize = {
    xs: 'xs',
    sm: 'xs',
    md: 'sm',
    lg: 'md'
  }[size] as any;

  if (compact) {
    return (
      <UnstyledButton
        ref={ref}
        onClick={onClick}
        style={{
          padding: 'var(--mantine-spacing-xs)',
          borderRadius: 'var(--mantine-radius-sm)',
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          ...style,
        }}
        className={className}
      >
        <Avatar
          src={user.avatar}
          radius="xl"
          size={avatarSize}
          name={user.username}
          color="primary"
        >
          {user.username?.charAt(0).toUpperCase() || 'U'}
        </Avatar>
      </UnstyledButton>
    );
  }

  return (
    <UnstyledButton
      ref={ref}
      onClick={onClick}
      style={{
        padding: 'var(--mantine-spacing-xs)',
        borderRadius: 'var(--mantine-radius-sm)',
        width: '100%',
        '&:hover': {
          backgroundColor: 'var(--mantine-color-gray-0)',
        },
        ...style,
      }}
      className={className}
    >
      <Group gap="sm" wrap="nowrap">
        <Avatar
          src={user.avatar}
          radius="xl"
          size={avatarSize}
          name={user.username}
          color="primary"
        >
          {user.username?.charAt(0).toUpperCase() || 'U'}
        </Avatar>

        <Box style={{ flex: 1, minWidth: 0 }}>
          <Text size={textSize} fw={500} truncate>
            {user.username}
          </Text>
          <Text c="dimmed" size={detailTextSize} truncate>
            {user.role}
            {user.points !== undefined && (
              <> • {user.points} pts</>
            )}
            {user.level !== undefined && (
              <> • Level {user.level}</>
            )}
          </Text>
        </Box>

        {withChevron && (
          <IconChevronDown
            size={14}
            stroke={1.5}
            style={{
              transition: 'transform 150ms ease',
            }}
          />
        )}
      </Group>
    </UnstyledButton>
  );
});

UserButton.displayName = 'UserButton';