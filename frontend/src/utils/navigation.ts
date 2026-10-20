/**
 * @fileoverview Navigation utilities for role-based access
 * @description Utilities to generate navigation items based on user roles
 * @author TaaskMaaster Team
 * @version 1.0.0
 */

import {
  HomeIcon,
  CheckCircleIcon,
  TrophyIcon,
  UserGroupIcon,
  StarIcon,
  ChartBarIcon,
  CalendarIcon,
  FireIcon,
  AcademicCapIcon,
  Cog6ToothIcon,
  ClipboardDocumentListIcon,
  UserIcon,
} from '@heroicons/react/24/outline';

/**
 * @description Navigation item interface
 */
export interface NavigationItem {
  /** Unique identifier for the navigation item */
  id: string;
  /** Display name for the navigation item */
  name: string;
  /** Icon component for the navigation item */
  icon?: React.ComponentType<{ className?: string }>;
  /** URL or route for the navigation item */
  href?: string;
  /** Whether the item is currently active */
  active?: boolean;
  /** Whether the item is disabled */
  disabled?: boolean;
  /** Optional badge or notification count */
  badge?: string | number;
  /** Optional sub-items for dropdown menus */
  children?: NavigationItem[];
  /** Required user roles to access this item */
  requiredRoles?: string[];
}

/**
 * @description User role types
 */
export type UserRole = 'user' | 'organizer' | 'admin';

/**
 * @description User interface for navigation
 */
export interface NavigationUser {
  id: string;
  username: string;
  email: string;
  role: string;
  points?: number;
  level?: number;
}

/**
 * @description Check if user has required role
 * @param userRole - User's role
 * @param requiredRoles - Required roles for access
 * @returns True if user has access
 */
export const hasRequiredRole = (userRole: string, requiredRoles: string[]): boolean => {
  if (!requiredRoles || requiredRoles.length === 0) {
    return true; // No role requirement
  }

  // Admin has access to everything
  if (userRole === 'admin') {
    return true;
  }

  // Check if user's role is in required roles
  return requiredRoles.includes(userRole);
};

/**
 * @description Get navigation items based on user role
 * @param user - Current user
 * @param activeItemId - Currently active navigation item ID
 * @returns Array of navigation items filtered by user role
 */
export const getNavigationItems = (
  user: NavigationUser | null,
  activeItemId?: string
): NavigationItem[] => {
  const baseNavigationItems: NavigationItem[] = [
    {
      id: 'dashboard',
      name: 'Dashboard',
      icon: HomeIcon,
      href: '/dashboard',
      active: activeItemId === 'dashboard',
    },
    {
      id: 'goals',
      name: 'Goals',
      icon: TrophyIcon,
      href: '/goals',
      active: activeItemId === 'goals',
    },
    {
      id: 'family',
      name: 'Family',
      icon: UserGroupIcon,
      href: '/family',
      active: activeItemId === 'family',
    },
    {
      id: 'achievements',
      name: 'Achievements',
      icon: StarIcon,
      href: '/achievements',
      active: activeItemId === 'achievements',
    },
    {
      id: 'leaderboard',
      name: 'Leaderboard',
      icon: ChartBarIcon,
      href: '/leaderboard',
      active: activeItemId === 'leaderboard',
    },
    {
      id: 'calendar',
      name: 'Calendar',
      icon: CalendarIcon,
      href: '/calendar',
      active: activeItemId === 'calendar',
    },
    {
      id: 'streaks',
      name: 'Streaks',
      icon: FireIcon,
      href: '/streaks',
      active: activeItemId === 'streaks',
    },
    {
      id: 'learning',
      name: 'Learning',
      icon: AcademicCapIcon,
      href: '/learning',
      active: activeItemId === 'learning',
    },
    {
      id: 'settings',
      name: 'Settings',
      icon: Cog6ToothIcon,
      href: '/settings',
      active: activeItemId === 'settings',
    },
  ];

  // If no user is provided, return only public items
  if (!user) {
    return baseNavigationItems.filter(item => !item.requiredRoles);
  }

  // Filter navigation items based on user role
  return baseNavigationItems.filter(item => {
    if (!item.requiredRoles) {
      return true; // No role requirement
    }
    return hasRequiredRole(user.role, item.requiredRoles);
  });
};

/**
 * @description Get task count badge for navigation item
 * @param itemId - Navigation item ID
 * @param taskCounts - Task counts object
 * @returns Badge count or undefined
 */
export const getTaskBadge = (
  itemId: string,
  taskCounts?: {
    myTasks?: number;
    allTasks?: number;
    pendingTasks?: number;
  }
): string | number | undefined => {
  if (!taskCounts) return undefined;

  switch (itemId) {
    default:
      return undefined;
  }
};

/**
 * @description Update navigation items with badges
 * @param navigationItems - Navigation items array
 * @param taskCounts - Task counts object
 * @returns Updated navigation items with badges
 */
export const updateNavigationWithBadges = (
  navigationItems: NavigationItem[],
  taskCounts?: {
    myTasks?: number;
    allTasks?: number;
    pendingTasks?: number;
  }
): NavigationItem[] => {
  return navigationItems.map(item => ({
    ...item,
    badge: getTaskBadge(item.id, taskCounts),
  }));
};

/**
 * @description Get page title based on navigation item
 * @param itemId - Navigation item ID
 * @returns Page title
 */
export const getPageTitle = (itemId: string): string => {
  const titleMap: Record<string, string> = {
    'dashboard': 'Dashboard',
    'goals': 'Goals',
    'family': 'Family',
    'achievements': 'Achievements',
    'leaderboard': 'Leaderboard',
    'calendar': 'Calendar',
    'streaks': 'Streaks',
    'learning': 'Learning',
    'settings': 'Settings',
  };

  return titleMap[itemId] || 'TaaskMaaster';
};

/**
 * @description Check if current user can access a specific page
 * @param user - Current user
 * @param pageId - Page identifier
 * @returns True if user can access the page
 */
export const canAccessPage = (user: NavigationUser | null, pageId: string): boolean => {
  const navigationItems = getNavigationItems(user);
  return navigationItems.some(item => item.id === pageId);
};
