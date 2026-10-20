import { useState } from 'react';
import { Tooltip, UnstyledButton, Stack, rem } from '@mantine/core';
import {
  IconHome,
  IconChecklist,
} from '@tabler/icons-react';
import { UserMenu } from '../ui/UserMenu';
import classes from './NavbarMinimal.module.css';

const navigationData = [
  { icon: IconHome, label: 'My Hub', id: 'hub' },
  { icon: IconChecklist, label: 'Tasks', id: 'tasks' },
];

interface NavbarMinimalProps {
  currentPage?: string;
  onNavigate?: (pageId: string) => void;
  user?: {
    id: string;
    username: string;
    email: string;
    role: string;
    points?: number;
    level?: number;
  } | null;
  onLogout?: () => void;
}

export function NavbarMinimal({ currentPage = 'dashboard', onNavigate, user, onLogout }: NavbarMinimalProps) {
  const links = navigationData.map((link, index) => (
    <Tooltip
      label={link.label}
      position="right"
      transitionProps={{ duration: 0 }}
      key={link.label}
    >
      <UnstyledButton
        onClick={() => onNavigate?.(link.id)}
        className={classes.link}
        data-active={currentPage === link.id || undefined}
      >
        <link.icon size={rem(24)} stroke={1.5} />
      </UnstyledButton>
    </Tooltip>
  ));

  return (
    <nav className={classes.navbar}>
      <div className={classes.navbarMain}>
        <Stack justify="center" gap="lg">
          {links}
        </Stack>
      </div>

      {user && (
        <div className={classes.footer}>
          <Tooltip
            label={user.username}
            position="right"
            transitionProps={{ duration: 0 }}
          >
            <UserMenu
              user={{ ...user, email: user.email || `${user.username}@example.com` }}
              position="top-end"
              width={280}
              onLogout={onLogout}
              onProfileClick={() => console.log('Profile clicked')}
              onSettingsClick={() => console.log('Settings clicked')}
              onNotificationsClick={() => console.log('Notifications clicked')}
              size="sm"
              compact={true}
            />
          </Tooltip>
        </div>
      )}
    </nav>
  );
}