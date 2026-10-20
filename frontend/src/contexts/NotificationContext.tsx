/**
 * @fileoverview Notification Context for Real-time Notifications
 * @description Manages WebSocket notifications, toasts, and real-time updates
 * @author TaaskMaaster Team
 * @version 1.0.0
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { notifications as mantineNotifications } from '@mantine/notifications';
import { IconCheck, IconX, IconAlertTriangle, IconInfoCircle, IconMessage, IconBell, IconUser, IconClipboard } from '@tabler/icons-react';
import { useWebSocket } from '../hooks/useWebSocket';
import { getLoginState } from '../utils/cookies';
import { notificationService, Notification as StoredNotification } from '../services/notificationService';
import { useUnifiedAuth } from './UnifiedAuthContext';
import { tokenManager } from '../services/tokenManager';
import { authService } from '../services/authService';

export interface NotificationData {
  id: string;
  type: 'task_comment' | 'task_assigned' | 'task_completed' | 'workflow_transition' | 'approval_request' | 'message' | 'mention';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  data?: any; // Additional notification-specific data
  actionUrl?: string; // URL to navigate to when clicked
  storedId?: number; // ID from database for stored notifications
}

export interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  duration?: number; // Auto-dismiss duration in ms
  persistent?: boolean; // Don't auto-dismiss
  actions?: {
    label: string;
    onClick: () => void;
    variant?: 'primary' | 'secondary';
  }[];
}

interface NotificationContextValue {
  // Notifications
  notifications: NotificationData[];
  unreadCount: number;
  markAsRead: (notificationId: string) => void;
  markAllAsRead: () => void;
  clearNotification: (notificationId: string) => void;
  clearAllNotifications: () => void;
  
  // Stored notifications management
  refreshStoredNotifications: (showMantineForNew?: boolean) => Promise<void>;
  markStoredAsRead: (storedIds: number[]) => Promise<void>;
  deleteStoredNotifications: (storedIds: number[]) => Promise<void>;
  
  // Toasts
  toasts: Toast[];
  showToast: (toast: Omit<Toast, 'id'>) => void;
  dismissToast: (toastId: string) => void;
  
  // WebSocket status
  isConnected: boolean;
  connectionError: string | null;
  
  // Navigation
  navigateFromNotification: (actionUrl: string) => void;
  
  // Real-time updates
  onNotificationReceived?: (notification: NotificationData) => void;
  setOnNotificationReceived: (callback: (notification: NotificationData) => void) => void;
  
  // Testing/Demo
  showTestMantineNotification: () => void;
}

const NotificationContext = createContext<NotificationContextValue | undefined>(undefined);

/**
 * @description Notification Provider Component
 */
export const NotificationProvider: React.FC<{ 
  children: React.ReactNode;
  onNavigation?: (pageId: string, taskId?: number) => void;
}> = ({ children, onNavigation }) => {
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [onNotificationReceived, setOnNotificationReceived] = useState<((notification: NotificationData) => void) | undefined>();
  
  // Get unified authentication state
  const { user, isAuthenticated, isLoading, isAuthReady } = useUnifiedAuth();
  
  // Track initialization to prevent infinite loops
  const initializationRef = useRef<{ lastUserId: string | null, wsConnected: boolean, notificationsLoaded: boolean, httpSystemInitialized: boolean }>({ 
    lastUserId: null, 
    wsConnected: false,
    notificationsLoaded: false,
    httpSystemInitialized: false
  });
  
  /**
   * @description Handle navigation from notification action URL
   */
  const handleNotificationNavigation = useCallback((actionUrl: string) => {
    
    // Parse task URLs for SPA navigation
    const taskMatch = actionUrl.match(/\/tasks\/(\d+)/);
    if (taskMatch) {
      const taskId = parseInt(taskMatch[1], 10);
      
      // Try to use global notification handler first (set by Dashboard)
      const globalHandler = (window as any).__notificationNavHandler;
      if (globalHandler) {
        globalHandler('dashboard', taskId);
        return;
      }
      
      // Fallback to onNavigation prop if provided
      if (onNavigation) {
        onNavigation('dashboard', taskId);
        return;
      }
    }

    // Handle other URL patterns with onNavigation prop
    if (onNavigation) {
      const pathMatch = actionUrl.match(/\/(.+)/);
      if (pathMatch) {
        const pageId = pathMatch[1];
        onNavigation(pageId);
      } else {
        onNavigation('dashboard');
      }
      return;
    }

    // Final fallback to direct navigation
    console.warn('🔔 No navigation handler available, falling back to window.location');
    window.location.href = actionUrl;
  }, [onNavigation]);

  /**
   * @description Show a Mantine notification with proper styling and positioning
   */
  const showMantineNotification = useCallback((notification: NotificationData) => {
    // Map notification types to appropriate icons and colors
    const getNotificationConfig = (type: NotificationData['type']) => {
      switch (type) {
        case 'task_comment':
          return { icon: <IconMessage size={20} />, color: 'blue' };
        case 'task_assigned':
          return { icon: <IconUser size={20} />, color: 'green' };
        case 'task_completed':
          return { icon: <IconCheck size={20} />, color: 'teal' };
        case 'workflow_transition':
          return { icon: <IconClipboard size={20} />, color: 'yellow' };
        case 'approval_request':
          return { icon: <IconAlertTriangle size={20} />, color: 'orange' };
        case 'message':
          return { icon: <IconMessage size={20} />, color: 'blue' };
        case 'mention':
          return { icon: <IconBell size={20} />, color: 'grape' };
        default:
          return { icon: <IconInfoCircle size={20} />, color: 'blue' };
      }
    };

    const config = getNotificationConfig(notification.type);
    
    // Show the Mantine notification exactly like AppLayout does
    mantineNotifications.show({
      title: notification.title,
      message: notification.message,
      color: config.color,
      icon: config.icon,
      autoClose: 10000, // 10 seconds as requested
    });
  }, [handleNotificationNavigation]);

  /**
   * @description Convert stored notification to NotificationData format
   */
  const convertStoredNotification = useCallback((stored: StoredNotification): NotificationData => {
    // Map notification type from backend to frontend format
    const typeMapping: Record<string, NotificationData['type']> = {
      'task_comment': 'task_comment',
      'task_assigned': 'task_assigned',
      'task_status_changed': 'workflow_transition',
      'task_approval_request': 'approval_request',
      'task_approved': 'approval_request',
      'task_rejected': 'approval_request',
      'user_mentioned': 'mention',
      'direct_message': 'message',
      'task_chat_message': 'message'
    };

    const priority = stored.data?.requires_action ? 'high' : 'medium';

    return {
      id: `stored_${stored.id}`,
      type: typeMapping[stored.type] || 'task_comment',
      title: stored.title,
      message: stored.message,
      timestamp: stored.created_at,
      read: stored.is_read,
      priority: priority as NotificationData['priority'],
      data: stored.data,
      actionUrl: stored.action_url || undefined,
      storedId: stored.id
    };
  }, []);

  /**
   * @description Fetch stored notifications from the backend
   */
  const refreshStoredNotifications = useCallback(async (showMantineForNew: boolean = false) => {
    // Use the unified auth ready check
    if (!isAuthReady()) {
      console.log('⚠️  Notifications: Auth not ready, skipping fetch');
      return;
    }

    try {
      const response = await notificationService.getNotifications(user!, {
        skip: 0,
        limit: 100,
        unread_only: false
      });

      const storedNotifications = response.notifications.map(convertStoredNotification);
      console.log('📥 Loaded notifications:', storedNotifications.length);
      
      // Mark HTTP notification system as initialized (regardless of notification count)
      initializationRef.current.httpSystemInitialized = true;
      
      // Merge with existing real-time notifications, avoiding duplicates
      setNotifications(prev => {
        const realTimeNotifications = prev.filter(n => !n.storedId);
        
        // If showMantineForNew is true, show Mantine notifications for new unread stored notifications
        if (showMantineForNew) {
          const existingStoredIds = prev.filter(n => n.storedId).map(n => n.storedId);
          const newStoredNotifications = storedNotifications.filter(n => 
            n.storedId && !existingStoredIds.includes(n.storedId) && !n.read
          );
          
          // Schedule Mantine notifications to avoid setState during render
          if (newStoredNotifications.length > 0) {
            setTimeout(() => {
              newStoredNotifications.forEach(notification => {
                showMantineNotification(notification);
              });
            }, 0);
          }
        }
        
        const combinedNotifications = [...realTimeNotifications, ...storedNotifications];
        
        return combinedNotifications.sort((a, b) => 
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
      });

    } catch (error: any) {
      console.error('Error fetching stored notifications:', error);
      throw error;
    }
  }, [convertStoredNotification, isAuthReady, user, showMantineNotification]);

  /**
   * @description Mark stored notifications as read via API
   */
  const markStoredAsRead = useCallback(async (storedIds: number[]) => {
    // Don't try to mark as read if not ready or no IDs provided
    if (!isAuthReady() || storedIds.length === 0) {
      return;
    }

    try {
      await notificationService.markNotificationsRead(user!, storedIds);
      
      // Update local state
      setNotifications(prev => 
        prev.map(notification => 
          notification.storedId && storedIds.includes(notification.storedId)
            ? { ...notification, read: true }
            : notification
        )
      );

    } catch (error: any) {
      console.error('Error marking stored notifications as read:', error);
      if (error?.response?.status !== 401) {
        console.error('Unexpected error marking notifications as read:', error);
      }
    }
  }, [isAuthReady]);

  /**
   * @description Delete stored notifications via API
   */
  const deleteStoredNotifications = useCallback(async (storedIds: number[]) => {
    // Don't try to delete if not ready or no IDs provided
    if (!isAuthReady() || storedIds.length === 0) {
      return;
    }

    try {
      await notificationService.deleteNotifications(user!, storedIds);
      
      // Remove from local state
      setNotifications(prev => 
        prev.filter(notification => 
          !notification.storedId || !storedIds.includes(notification.storedId)
        )
      );

    } catch (error: any) {
      console.error('Error deleting stored notifications:', error);
      if (error?.response?.status !== 401) {
        console.error('Unexpected error deleting notifications:', error);
      }
    }
  }, [isAuthReady]);

  // WebSocket connection through frontend proxy (custom server handles this)
  const wsUrl = typeof window !== 'undefined' 
    ? `ws://${window.location.host}/ws/notifications`
    : 'ws://localhost:3000/ws/notifications';
  
  
  const notificationWS = useWebSocket({
    url: wsUrl,
    autoConnect: false
  });

  /**
   * @description Add a new notification
   */
  const addNotification = useCallback((notification: NotificationData) => {
    setNotifications(prev => [notification, ...prev].slice(0, 100)); // Keep max 100 notifications
    
    // Call external callback if set
    if (onNotificationReceived) {
      onNotificationReceived(notification);
    }
  }, [onNotificationReceived]);

  /**
   * @description Dismiss a toast
   */
  const dismissToast = useCallback((toastId: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== toastId));
  }, []);

  /**
   * @description Show a toast notification
   */
  const showToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newToast: Toast = { ...toast, id };
    
    setToasts(prev => [...prev, newToast]);
    
    // Auto-dismiss non-persistent toasts
    if (!toast.persistent && toast.duration !== 0) {
      const duration = toast.duration || 5000;
      setTimeout(() => {
        dismissToast(id);
      }, duration);
    }
  }, [dismissToast]);

  /**
   * @description Handle task comment notifications
   */
  const handleTaskCommentNotification = useCallback((data: any) => {
    // Extract the actual data from the notification object
    const notificationData = data.data || data;
    
    const notification: NotificationData = {
      id: `comment_${notificationData.comment_id}_${Date.now()}`,
      type: 'task_comment',
      title: data.title || 'New Comment',
      message: data.message || `${notificationData.user?.username || 'Someone'} commented on "${notificationData.task_title || 'a task'}"`,
      timestamp: data.timestamp || new Date().toISOString(),
      read: false,
      priority: 'medium',
      data: notificationData,
      actionUrl: data.action_url || `/tasks/${notificationData.task_id}`
    };

    addNotification(notification);
    
    // Show Mantine notification
    showMantineNotification(notification);
    
    // Show toast for immediate feedback
    showToast({
      type: 'info',
      title: 'New Comment',
      message: notification.message,
      duration: 4000,
      actions: [{
        label: 'View',
        onClick: () => {
          // Navigate to task using SPA navigation
          handleNotificationNavigation(notification.actionUrl!);
        }
      }]
    });
  }, [addNotification, showToast, showMantineNotification, handleNotificationNavigation]);

  /**
   * @description Handle task assigned notifications
   */
  const handleTaskAssignedNotification = useCallback((data: any) => {
    const notification: NotificationData = {
      id: `assigned_${data.task_id}_${Date.now()}`,
      type: 'task_assigned',
      title: 'Task Assigned',
      message: `You've been assigned to "${data.task_title || 'a task'}"`,
      timestamp: new Date().toISOString(),
      read: false,
      priority: 'high',
      data: data,
      actionUrl: `/tasks/${data.task_id}`
    };

    addNotification(notification);
    
    // Show Mantine notification
    showMantineNotification(notification);
    
    showToast({
      type: 'info',
      title: 'Task Assigned',
      message: notification.message,
      duration: 6000,
      actions: [{
        label: 'View Task',
        onClick: () => {
          handleNotificationNavigation(notification.actionUrl!);
        }
      }]
    });
  }, [addNotification, showToast, showMantineNotification, handleNotificationNavigation]);

  /**
   * @description Handle task completed notifications
   */
  const handleTaskCompletedNotification = useCallback((data: any) => {
    const notificationData = data.data || data;
    
    const notification: NotificationData = {
      id: `completed_${notificationData.task_id}_${Date.now()}`,
      type: 'task_completed',
      title: data.title || 'Task Completed',
      message: data.message || `Task "${notificationData.task_title || 'Unknown'}" has been completed`,
      timestamp: data.timestamp || new Date().toISOString(),
      read: false,
      priority: 'medium',
      data: notificationData,
      actionUrl: data.action_url || `/tasks/${notificationData.task_id}`
    };

    addNotification(notification);
    
    // Show Mantine notification
    showMantineNotification(notification);
    
    // Show toast for immediate feedback
    showToast({
      type: 'success',
      title: 'Task Completed',
      message: notification.message,
      duration: 4000,
      actions: [{
        label: 'View Task',
        onClick: () => {
          handleNotificationNavigation(notification.actionUrl!);
        }
      }]
    });
  }, [addNotification, showToast, showMantineNotification, handleNotificationNavigation]);

  /**
   * @description Handle workflow transition notifications
   */
  const handleWorkflowTransitionNotification = useCallback((data: any) => {
    // Extract the actual data from the notification object
    const notificationData = data.data || data;
    
    const notification: NotificationData = {
      id: `workflow_${notificationData.task_id}_${Date.now()}`,
      type: 'workflow_transition',
      title: data.title || 'Task Status Changed',
      message: data.message || `"${notificationData.task_title || 'A task'}" moved to ${notificationData.new_status?.replace('_', ' ')}`,
      timestamp: data.timestamp || new Date().toISOString(),
      read: false,
      priority: 'medium',
      data: notificationData,
      actionUrl: data.action_url || `/tasks/${notificationData.task_id}`
    };

    addNotification(notification);
    
    // Show Mantine notification
    showMantineNotification(notification);
  }, [addNotification, showMantineNotification]);

  /**
   * @description Handle approval request notifications
   */
  const handleApprovalRequestNotification = useCallback((data: any) => {
    const notification: NotificationData = {
      id: `approval_${data.task_id}_${Date.now()}`,
      type: 'approval_request',
      title: 'Approval Requested',
      message: `"${data.task_title || 'A task'}" is ready for your approval`,
      timestamp: new Date().toISOString(),
      read: false,
      priority: 'urgent',
      data: data,
      actionUrl: `/tasks/${data.task_id}`
    };

    addNotification(notification);
    
    // Show Mantine notification
    showMantineNotification(notification);
    
    showToast({
      type: 'warning',
      title: 'Approval Needed',
      message: notification.message,
      persistent: true,
      actions: [{
        label: 'Review',
        onClick: () => {
          handleNotificationNavigation(notification.actionUrl!);
        },
        variant: 'primary'
      }]
    });
  }, [addNotification, showToast, showMantineNotification, handleNotificationNavigation]);

  /**
   * @description Handle message notifications
   */
  const handleMessageNotification = useCallback((data: any) => {
    const notification: NotificationData = {
      id: `message_${data.message_id}_${Date.now()}`,
      type: 'message',
      title: 'New Message',
      message: `${data.sender?.username || 'Someone'} sent you a message`,
      timestamp: new Date().toISOString(),
      read: false,
      priority: 'medium',
      data: data,
      actionUrl: `/messages/${data.conversation_id}`
    };

    addNotification(notification);
    
    // Show Mantine notification
    showMantineNotification(notification);
    
    showToast({
      type: 'info',
      title: 'New Message',
      message: notification.message,
      duration: 4000
    });
  }, [addNotification, showToast, showMantineNotification]);

  /**
   * @description Handle mention notifications
   */
  const handleMentionNotification = useCallback((data: any) => {
    const notification: NotificationData = {
      id: `mention_${data.task_id}_${Date.now()}`,
      type: 'mention',
      title: 'You were mentioned',
      message: `${data.user?.username || 'Someone'} mentioned you in "${data.task_title || 'a task'}"`,
      timestamp: new Date().toISOString(),
      read: false,
      priority: 'high',
      data: data,
      actionUrl: `/tasks/${data.task_id}`
    };

    addNotification(notification);
    
    // Show Mantine notification
    showMantineNotification(notification);
    
    showToast({
      type: 'info',
      title: 'Mentioned',
      message: notification.message,
      duration: 5000,
      actions: [{
        label: 'View',
        onClick: () => {
          handleNotificationNavigation(notification.actionUrl!);
        }
      }]
    });
  }, [addNotification, showToast, showMantineNotification, handleNotificationNavigation]);

  /**
   * @description Handle general notifications (deleted, due soon, overdue, media, system)
   */
  const handleGeneralNotification = useCallback((data: any) => {
    const notificationData = data.data || data;
    
    // Map notification types to display types
    const typeMapping: Record<string, NotificationData['type']> = {
      'task_deleted': 'task_comment', // Use existing type for now
      'task_due_soon': 'task_comment',
      'task_overdue': 'task_comment',
      'media_attached': 'task_comment',
      'system_announcement': 'task_comment'
    };
    
    const notification: NotificationData = {
      id: `general_${data.type}_${Date.now()}`,
      type: typeMapping[data.type] || 'task_comment',
      title: data.title || 'Notification',
      message: data.message || 'You have a new notification',
      timestamp: data.timestamp || new Date().toISOString(),
      read: false,
      priority: data.priority || 'medium',
      data: notificationData,
      actionUrl: data.action_url || (notificationData.task_id ? `/tasks/${notificationData.task_id}` : '/dashboard')
    };

    addNotification(notification);
    
    // Show Mantine notification
    showMantineNotification(notification);
    
    // Show toast for immediate feedback
    showToast({
      type: data.type === 'system_announcement' ? 'info' : 'warning',
      title: notification.title,
      message: notification.message,
      duration: 5000,
      actions: [{
        label: 'View',
        onClick: () => {
          handleNotificationNavigation(notification.actionUrl!);
        }
      }]
    });
  }, [addNotification, showToast, showMantineNotification, handleNotificationNavigation]);


  /**
   * @description Handle incoming WebSocket messages
   */
  const handleWebSocketMessage = useCallback((data: any) => {
    try {
      
      // Handle different types of real-time updates
      switch (data.type) {
        case 'task_comment':
          handleTaskCommentNotification(data);
          break;
        case 'task_assigned':
        case 'task_reassigned':
        case 'task_created':
          handleTaskAssignedNotification(data);
          break;
        case 'task_completed':
          handleTaskCompletedNotification(data);
          break;
        case 'task_status_changed':
        case 'task_updated':
          handleWorkflowTransitionNotification(data);
          break;
        case 'task_approval_request':
        case 'task_approved':
        case 'task_rejected':
          handleApprovalRequestNotification(data);
          break;
        case 'direct_message':
        case 'task_chat_message':
          handleMessageNotification(data);
          break;
        case 'user_mentioned':
          handleMentionNotification(data);
          break;
        case 'task_deleted':
        case 'task_due_soon':
        case 'task_overdue':
        case 'media_attached':
        case 'system_announcement':
          handleGeneralNotification(data);
          break;
      }
    } catch (error) {
      console.error('Error handling WebSocket message:', error);
    }
  }, [
    handleTaskCommentNotification,
    handleTaskAssignedNotification,
    handleTaskCompletedNotification,
    handleWorkflowTransitionNotification,
    handleApprovalRequestNotification,
    handleMessageNotification,
    handleMentionNotification,
    handleGeneralNotification
  ]);

  /**
   * @description Mark notification as read (handles both real-time and stored)
   */
  const markAsRead = useCallback(async (notificationId: string) => {
    const notification = notifications.find(n => n.id === notificationId);
    
    // Update local state immediately
    setNotifications(prev => 
      prev.map(n => 
        n.id === notificationId 
          ? { ...n, read: true }
          : n
      )
    );

    // If it's a stored notification, also update on the backend
    if (notification?.storedId) {
      try {
        await markStoredAsRead([notification.storedId]);
      } catch (error) {
        console.error('Failed to mark stored notification as read:', error);
        // Revert local state on error
        setNotifications(prev => 
          prev.map(n => 
            n.id === notificationId 
              ? { ...n, read: false }
              : n
          )
        );
      }
    }
  }, [notifications, markStoredAsRead]);

  /**
   * @description Mark all notifications as read (handles both real-time and stored)
   */
  const markAllAsRead = useCallback(async () => {
    // Get stored notification IDs that are unread
    const unreadStoredIds = notifications
      .filter(n => !n.read && n.storedId)
      .map(n => n.storedId!)
      .filter(id => id !== undefined);

    // Update local state immediately
    setNotifications(prev => 
      prev.map(notification => ({ ...notification, read: true }))
    );

    // Update stored notifications on the backend
    if (unreadStoredIds.length > 0) {
      try {
        await markStoredAsRead(unreadStoredIds);
      } catch (error) {
        console.error('Failed to mark all stored notifications as read:', error);
        // Revert local state on error
        setNotifications(prev => 
          prev.map(n => 
            n.storedId && unreadStoredIds.includes(n.storedId) 
              ? { ...n, read: false }
              : n
          )
        );
      }
    }
  }, [notifications, markStoredAsRead]);

  /**
   * @description Clear a specific notification
   */
  const clearNotification = useCallback((notificationId: string) => {
    setNotifications(prev => prev.filter(notification => notification.id !== notificationId));
  }, []);

  /**
   * @description Clear all notifications (both local and stored)
   */
  const clearAllNotifications = useCallback(async () => {
    // Find all stored notifications (those with storedId)
    const storedIds = notifications
      .filter(notification => notification.storedId)
      .map(notification => notification.storedId!);
    
    // Delete stored notifications from database if any exist
    if (storedIds.length > 0) {
      try {
        await deleteStoredNotifications(storedIds);
      } catch (error) {
        console.error('Failed to delete stored notifications:', error);
        // Continue with local clearing even if database deletion fails
      }
    }
    
    // Clear all notifications from local state (both stored and real-time)
    setNotifications([]);
  }, [notifications, deleteStoredNotifications]);

  /**
   * @description Test function to show a Mantine notification directly
   */
  const showTestMantineNotification = useCallback(() => {
    const testNotification: NotificationData = {
      id: `test_${Date.now()}`,
      type: 'task_comment',
      title: '🧪 Test Mantine Notification',
      message: 'This is a test notification to verify Mantine notifications are working correctly!',
      timestamp: new Date().toISOString(),
      read: false,
      priority: 'medium',
      actionUrl: '/dashboard'
    };
    
    console.log('🧪 Showing test Mantine notification:', testNotification);
    showMantineNotification(testNotification);
  }, [showMantineNotification]);

  // Calculate unread count
  const unreadCount = notifications.filter(n => !n.read).length;
  

  // Subscribe to WebSocket messages
  useEffect(() => {
    if (!notificationWS.isConnected) return;


    
    // Subscribe to all notification types
    const unsubscribers = [
      notificationWS.subscribe('task_comment', handleWebSocketMessage),
      notificationWS.subscribe('task_assigned', handleWebSocketMessage),
      notificationWS.subscribe('task_reassigned', handleWebSocketMessage),
      notificationWS.subscribe('task_created', handleWebSocketMessage),
      notificationWS.subscribe('task_completed', handleWebSocketMessage),
      notificationWS.subscribe('task_status_changed', handleWebSocketMessage),
      notificationWS.subscribe('task_updated', handleWebSocketMessage),
      notificationWS.subscribe('task_approval_request', handleWebSocketMessage),
      notificationWS.subscribe('task_approved', handleWebSocketMessage),
      notificationWS.subscribe('task_rejected', handleWebSocketMessage),
      notificationWS.subscribe('direct_message', handleWebSocketMessage),
      notificationWS.subscribe('task_chat_message', handleWebSocketMessage),
      notificationWS.subscribe('user_mentioned', handleWebSocketMessage),
      notificationWS.subscribe('task_deleted', handleWebSocketMessage),
      notificationWS.subscribe('task_due_soon', handleWebSocketMessage),
      notificationWS.subscribe('task_overdue', handleWebSocketMessage),
      notificationWS.subscribe('media_attached', handleWebSocketMessage),
      notificationWS.subscribe('system_announcement', handleWebSocketMessage)
    ];

    return () => {
      unsubscribers.forEach(unsubscribe => unsubscribe());
    };
  }, [notificationWS.isConnected]);

  // Fallback polling when WebSocket fails
  useEffect(() => {
    if (!isAuthReady() || notificationWS.isConnected) return;

    // Set up polling as fallback (every 30 seconds)
    const pollInterval = setInterval(async () => {
      console.log('🔄 Polling for notifications (WebSocket fallback)');
      await refreshStoredNotifications();
    }, 30000);

    return () => clearInterval(pollInterval);
  }, [isAuthReady(), notificationWS.isConnected, refreshStoredNotifications]);

  // WebSocket connection management and initial notification load
  useEffect(() => {
    // Only proceed if auth is fully ready (not just loading)
    if (isAuthReady() && !isLoading && isAuthenticated && user) {
      const currentUserId = user.id;
      
      // Reset if user changed
      if (initializationRef.current.lastUserId !== currentUserId) {
        console.log('🔄 User changed, resetting notification system for user:', currentUserId);
        initializationRef.current.lastUserId = currentUserId;
        initializationRef.current.wsConnected = false;
        initializationRef.current.notificationsLoaded = false;
        initializationRef.current.httpSystemInitialized = false;
        setNotifications([]); // Clear existing notifications for new user
      }
      
      // Load initial notifications first (this works via HTTP) - only once per user
      if (!initializationRef.current.notificationsLoaded) {
        console.log('📥 Loading initial notifications for user:', currentUserId);
        refreshStoredNotifications().then(() => {
          initializationRef.current.notificationsLoaded = true;
        }).catch(error => {
          console.error('Failed to load initial notifications:', error);
          initializationRef.current.notificationsLoaded = true; // Mark as attempted
        });
      }
      
      // Connect WebSocket for real-time notifications with a small delay
      // to ensure auth is fully settled - only once per user
      if (!initializationRef.current.wsConnected) {
        const connectTimeout = setTimeout(() => {
          console.log('🔌 Attempting WebSocket connection for user:', currentUserId);
          try {
            notificationWS.connect();
            initializationRef.current.wsConnected = true;
          } catch (error) {
            console.warn('🔴 WebSocket connection failed, will use HTTP polling fallback:', error);
            initializationRef.current.wsConnected = true; // Mark as attempted to prevent retries
          }
        }, 1000);
        
        return () => clearTimeout(connectTimeout);
      }
    } else {
      // Clear state when not authenticated or still loading
      if (!isAuthenticated || isLoading) {
        console.log('🚪 User not authenticated, clearing notification state');
        setNotifications([]);
        notificationWS.disconnect();
        initializationRef.current.wsConnected = false;
        initializationRef.current.notificationsLoaded = false;
        initializationRef.current.httpSystemInitialized = false;
        initializationRef.current.lastUserId = null;
      }
    }
  }, [isAuthenticated, isLoading, user?.id]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      notificationWS.disconnect();
    };
  }, [notificationWS]);

  const value: NotificationContextValue = useMemo(() => ({
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    clearNotification,
    clearAllNotifications,
    refreshStoredNotifications,
    markStoredAsRead,
    deleteStoredNotifications,
    toasts,
    showToast,
    dismissToast,
    isConnected: (() => {
      const authConnected = isAuthenticated && isAuthReady();
      const wsConnected = notificationWS.isConnected;
      const wsConnecting = notificationWS.isConnecting;
      const httpSystemWorking = initializationRef.current.httpSystemInitialized;
      const notificationsLoaded = initializationRef.current.notificationsLoaded;
      
      // If not authenticated, show as disconnected
      if (!authConnected) {
        return false;
      }
      
      // If authenticated, consider connected if:
      // 1. WebSocket is connected or connecting, OR
      // 2. HTTP notification system is working (has loaded notifications at least once)
      const connected = wsConnected || wsConnecting || (httpSystemWorking && notificationsLoaded);
      
      // Only log disconnected state if we're sure the system has had time to initialize
      // and we have a user ID set (meaning initialization was attempted)
      if (!connected && authConnected && initializationRef.current.lastUserId && notificationsLoaded) {
        console.log('🔴 Notifications disconnected - wsConnected:', wsConnected, 'wsConnecting:', wsConnecting, 'httpSystemWorking:', httpSystemWorking);
      }
      
      return connected;
    })(), // Connected if authenticated and system is working
    connectionError: notificationWS.error,
    navigateFromNotification: handleNotificationNavigation,
    onNotificationReceived,
    setOnNotificationReceived,
    showTestMantineNotification
  }), [
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    clearNotification,
    clearAllNotifications,
    refreshStoredNotifications,
    markStoredAsRead,
    deleteStoredNotifications,
    toasts,
    showToast,
    dismissToast,
    isAuthenticated,
    isAuthReady,
    notificationWS.isConnected,
    notificationWS.isConnecting,
    notificationWS.error,
    handleNotificationNavigation,
    onNotificationReceived,
    setOnNotificationReceived,
    showTestMantineNotification
  ]);

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};

/**
 * @description Hook to use notification context
 */
export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};
