import {
  IconHome,
  IconChecklist,
  IconSettings,
  IconUser,
  IconLogout,
  IconBell,
  IconShield,
} from '@tabler/icons-react';
import { Group, ScrollArea } from '@mantine/core';
import { LinksGroup } from './NavbarLinksGroup';
import { UserMenu } from '../ui/UserMenu';
import classes from './NavbarNested.module.css';

const navigationData = [
  { 
    label: 'My Hub', 
    icon: IconHome,
    id: 'hub'
  },
  {
    label: 'Tasks',
    icon: IconChecklist,
    id: 'tasks',
    initiallyOpened: true,
    links: [
      { label: 'All Tasks', link: '/tasks' },
      { label: 'Templates', link: '/templates' },
    ],
  },
];

interface NavbarNestedProps {
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
  hoverMode?: boolean;
}

export function NavbarNested({ currentPage = 'dashboard', onNavigate, user, onLogout, hoverMode = false }: NavbarNestedProps) {
  const links = navigationData.map((item) => (
    <LinksGroup
      key={item.label}
      icon={item.icon}
      label={item.label}
      initiallyOpened={item.initiallyOpened}
      links={item.links}
      active={currentPage === item.id}
      onClick={() => onNavigate?.(item.id)}
      hoverMode={hoverMode}
    />
  ));

  return (
    <nav className={classes.navbar}>
      {/* Navigation Links */}
      <ScrollArea className={classes.links}>
        <div>
          {links}
        </div>
      </ScrollArea>

      {/* User Menu Section */}
      <div className={classes.footer}>
        {user && (
          <UserMenu
            user={{ ...user, email: user.email || `${user.username}@example.com` }}
            position="top-end"
            width={280}
            onLogout={onLogout}
            onProfileClick={() => console.log('Profile clicked')}
            onSettingsClick={() => console.log('Settings clicked')}
            onNotificationsClick={() => console.log('Notifications clicked')}
            size="sm"
          />
        )}
      </div>
    </nav>
  );
}