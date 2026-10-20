/**
 * @fileoverview UserMenu Component
 * @description A comprehensive user menu component following Mantine's design patterns
 * @author TaaskMaaster Team
 * @version 1.0.0
 */

import React, { useState, forwardRef } from 'react';
import { 
  Menu, 
  Avatar, 
  Text, 
  Group, 
  Divider, 
  Box
} from '@mantine/core';
import {
  IconUser,
  IconSettings,
  IconBell,
  IconShield,
  IconLogout,
  IconPalette,
  IconHeart,
  IconBookmark,
  IconMessage
} from '@tabler/icons-react';
import { UserButton } from './UserButton';
import { AppearanceModal } from './AppearanceModal';

interface UserMenuProps {
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
  /** Menu position */
  position?: 'top-end' | 'right-end' | 'bottom-end' | 'left-end';
  /** Menu width */
  width?: number;
  /** Logout handler */
  onLogout?: () => void;
  /** Profile click handler */
  onProfileClick?: () => void;
  /** Settings click handler */
  onSettingsClick?: () => void;
  /** Notifications click handler */
  onNotificationsClick?: () => void;
  /** Custom menu items */
  children?: React.ReactNode;
  /** Whether to show UserButton in compact mode */
  compact?: boolean;
  /** UserButton size */
  size?: 'xs' | 'sm' | 'md' | 'lg';
}

export const UserMenu = forwardRef<HTMLDivElement, UserMenuProps>(({
  user,
  position = 'top-end',
  width = 280,
  onLogout,
  onProfileClick,
  onSettingsClick,
  onNotificationsClick,
  children,
  compact = false,
  size = 'sm'
}, ref) => {
  const [appearanceModalOpened, setAppearanceModalOpened] = useState(false);
  return (
    <div ref={ref}>
      <Menu
        withArrow
        width={width}
        position={position}
        offset={5}
        withinPortal
        transitionProps={{ transition: 'pop-top-right' }}
      >
        <Menu.Target>
          <UserButton 
            user={user}
            size={size}
            compact={compact}
            withChevron={!compact}
          />
        </Menu.Target>

      <Menu.Dropdown>
        {/* User Info Header */}
        <Box p="sm">
          <Group gap="sm" wrap="nowrap">
            <Avatar
              src={user.avatar}
              radius="xl"
              size="md"
              name={user.username}
              color="primary"
            >
              {user.username?.charAt(0).toUpperCase() || 'U'}
            </Avatar>
            <Box style={{ flex: 1, minWidth: 0 }}>
              <Text size="sm" fw={500} truncate>
                {user.username}
              </Text>
              <Text size="xs" c="dimmed" truncate>
                {user.email}
              </Text>
            </Box>
          </Group>
        </Box>

        <Divider />

        {/* User Actions */}
        <Menu.Label>Account</Menu.Label>
        <Menu.Item 
          leftSection={<IconUser size={16} stroke={1.5} />}
          onClick={onProfileClick}
        >
          Profile
        </Menu.Item>
        <Menu.Item 
          leftSection={<IconSettings size={16} stroke={1.5} />}
          onClick={onSettingsClick}
        >
          Settings
        </Menu.Item>
        <Menu.Item 
          leftSection={<IconBell size={16} stroke={1.5} />}
          onClick={onNotificationsClick}
        >
          Notifications
        </Menu.Item>

        {/* User Activity */}
        <Menu.Label>Activity</Menu.Label>
        <Menu.Item 
          leftSection={<IconHeart size={16} stroke={1.5} />}
          onClick={() => console.log('Liked items clicked')}
        >
          Liked items
        </Menu.Item>
        <Menu.Item 
          leftSection={<IconBookmark size={16} stroke={1.5} />}
          onClick={() => console.log('Saved items clicked')}
        >
          Saved items
        </Menu.Item>
        <Menu.Item 
          leftSection={<IconMessage size={16} stroke={1.5} />}
          onClick={() => console.log('Your comments clicked')}
        >
          Your comments
        </Menu.Item>

        {/* Custom menu items */}
        {children && (
          <>
            <Divider />
            {children}
          </>
        )}

        {/* Settings Submenu */}
        <Divider />
        <Menu.Label>Preferences</Menu.Label>
        
        {/* Appearance */}
        <Menu.Item 
          leftSection={<IconPalette size={16} stroke={1.5} />}
          onClick={() => setAppearanceModalOpened(true)}
        >
          Appearance
        </Menu.Item>
        
        <Menu.Item 
          leftSection={<IconShield size={16} stroke={1.5} />}
          onClick={() => console.log('Privacy clicked')}
        >
          Privacy & Security
        </Menu.Item>

        <Divider />

        {/* Logout */}
        <Menu.Item 
          leftSection={<IconLogout size={16} stroke={1.5} />}
          onClick={onLogout}
          color="red"
        >
          Logout
        </Menu.Item>
      </Menu.Dropdown>

      {/* Appearance Modal */}
      <AppearanceModal
        opened={appearanceModalOpened}
        onClose={() => setAppearanceModalOpened(false)}
      />
      </Menu>
    </div>
  );
});

UserMenu.displayName = 'UserMenu';