/**
 * @fileoverview Simple App Router Component for TaaskMaaster
 * @description Handles routing between different pages based on navigation
 * @author TaaskMaaster Team
 * @version 1.0.0
 */

import React, { useState, useEffect } from 'react';
import { Dashboard } from './pages/Dashboard';
import { canAccessPage, type NavigationUser } from '../utils/navigation';
import { ToastContainer } from './notifications/ToastContainer';

/**
 * @description Current page type
 */
export type CurrentPage = 'dashboard' | 'goals' | 'family' | 'achievements' | 'leaderboard' | 'calendar' | 'streaks' | 'learning' | 'settings';

/**
 * @description App Router component props
 */
export interface AppRouterProps {
  /**
   * @description User data
   */
  user?: {
    id: string;
    username: string;
    email: string;
    role: string;
    points?: number;
    level?: number;
  } | null;
  /**
   * @description Function to handle logout
   */
  onLogout?: () => void;
  /**
   * @description Initial page to load
   */
  initialPage?: CurrentPage;
  /**
   * @description Initial task ID to open
   */
  initialTaskId?: number | null;
  /**
   * @description Function called when navigating from notifications
   */
  onNotificationNavigation?: (pageId: string, taskId?: number) => void;
  /**
   * @description Additional CSS classes
   */
  className?: string;
}

/**
 * @description App Router component
 * @param props - App Router component props
 * @returns App Router component
 */
export const AppRouter: React.FC<AppRouterProps> = ({
  user,
  onLogout,
  initialPage = 'dashboard',
  initialTaskId,
  onNotificationNavigation,
  className,
}) => {
  const [currentPage, setCurrentPage] = useState<CurrentPage>(initialPage);
  const [currentTaskId, setCurrentTaskId] = useState<number | undefined>(undefined);
  const [notificationTrigger, setNotificationTrigger] = useState<number>(0);

  // Initialize page only on mount, don't sync with prop changes after that
  useEffect(() => {
    setCurrentPage(initialPage);
  }, [initialPage]); // Include initialPage in dependencies

  // Sync with initialTaskId prop changes (only when initialTaskId actually changes)
  useEffect(() => {
    // Check if this is a notification navigation (has taskId)
    if (initialTaskId) {
      // Always increment trigger for notification navigation (even if same taskId)
      const newTrigger = notificationTrigger + 1;
      setNotificationTrigger(newTrigger);
      
      // Update the current page to match the initialPage (for notification navigation)
      if (initialPage !== currentPage) {
        setCurrentPage(initialPage);
      }
    }
    
    // Always update currentTaskId
    setCurrentTaskId(initialTaskId || undefined);
  }, [initialTaskId, initialPage, currentPage, notificationTrigger]); // Include all dependencies

  /**
   * @description Handle navigation between pages
   * @param pageId - Page identifier
   */
  const handleNavigation = (pageId: string) => {
    const page = pageId as CurrentPage;
    
    // Check if user has access to the requested page
    if (!canAccessPage(user as NavigationUser | null, page)) {
      console.warn(`User does not have access to page: ${page}`);
      return;
    }

    // Clear task ID when navigating normally
    setCurrentTaskId(undefined);
    
    // Update current page
    setCurrentPage(page);
    
    // Don't update browser URL for SPA - keep it simple
    // All routing is handled client-side
  };

  /**
   * @description Handle navigation from notifications (with optional task ID)
   * @param pageId - Page identifier
   * @param taskId - Optional task ID to open
   */
  const handleNotificationNavigation = (pageId: string, taskId?: number) => {
    console.log('🧭 AppRouter: handleNotificationNavigation called with:', pageId, taskId);
    const page = pageId as CurrentPage;
    
    // Check if user has access to the requested page
    if (!canAccessPage(user as NavigationUser | null, page)) {
      console.warn(`User does not have access to page: ${page}`);
      return;
    }


    
    // Increment notification trigger to ensure modal re-opens even for same task
    const newTrigger = notificationTrigger + 1;
    setNotificationTrigger(newTrigger);

    
    // Set page and task ID
    setCurrentPage(page);
    setCurrentTaskId(taskId);
    
    // Don't update browser URL for SPA - keep it simple
    // All routing is handled client-side
  };

  // No browser navigation handling needed for SPA

  /**
   * @description Render the current page component
   */
  const renderCurrentPage = () => {

    switch (currentPage) {
      case 'dashboard':
        return (
          <Dashboard
            user={user}
            onLogout={onLogout}
            onNavigation={handleNavigation}
            onNotificationNavigation={handleNotificationNavigation}
            className={className}
          />
        );
      
      // Placeholder pages for other navigation items
      case 'goals':
      case 'family':
      case 'achievements':
      case 'leaderboard':
      case 'calendar':
      case 'streaks':
      case 'learning':
      case 'settings':
        return (
          <Dashboard
            user={user}
            onLogout={onLogout}
            onNavigation={handleNavigation}
            className={className}
          />
        );
      
      default:
        return (
          <Dashboard
            user={user}
            onLogout={onLogout}
            onNavigation={handleNavigation}
            className={className}
          />
        );
    }
  };

  return (
    <>
      {renderCurrentPage()}
      <ToastContainer />
    </>
  );
};

/**
 * @description Hook to get current page
 * @returns Current page identifier
 */
export const useCurrentPage = (): CurrentPage => {
  const [currentPage, setCurrentPage] = useState<CurrentPage>('dashboard');

  useEffect(() => {
    const path = window.location.pathname.slice(1) || 'dashboard';
    setCurrentPage(path as CurrentPage);
  }, []);

  return currentPage;
};
