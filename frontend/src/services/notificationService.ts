/**
 * Notification service for TaaskMaaster frontend.
 * 
 * This service handles API calls for notification persistence,
 * following the X-User-Data header pattern used by other services.
 */

import { api } from './api';

/**
 * Notification data structure
 */
export interface Notification {
  id: number;
  user_id: number;
  type: string;
  title: string;
  message: string;
  action_url?: string;
  data?: any;
  is_read: boolean;
  created_at: string;
  read_at?: string;
}

/**
 * Request interface for getting notifications
 */
export interface GetNotificationsRequest {
  skip?: number;
  limit?: number;
  unread_only?: boolean;
  notification_types?: string[];
}

/**
 * Response interface for notification list
 */
export interface NotificationListResponse {
  notifications: Notification[];
  total: number;
  unread_count: number;
  has_more: boolean;
}

/**
 * Request interface for marking notifications as read
 */
export interface MarkReadRequest {
  notification_ids: number[];
}

/**
 * Response interface for mark read operation
 */
export interface MarkReadResponse {
  marked_read: number;
  success: boolean;
}

/**
 * Request interface for deleting notifications
 */
export interface DeleteNotificationsRequest {
  notification_ids: number[];
}

/**
 * Response interface for delete operation
 */
export interface DeleteNotificationsResponse {
  deleted: number;
  success: boolean;
}

/**
 * Notification statistics
 */
export interface NotificationStats {
  total_notifications: number;
  unread_count: number;
  read_count: number;
  types: Record<string, number>;
}

/**
 * Notification service class
 */
export class NotificationService {
  private baseUrl = '/notifications';

  /**
   * Create user data header for API requests
   */
  private createUserDataHeader(user: any): Record<string, string> {
    const userDataHeader = {
      'X-User-Data': JSON.stringify({
        user_id: user.id,
        username: user.username,
        role: user.role || 'user'
      })
    };
    // console.log('📋 Creating X-User-Data header:', userDataHeader); // Debug log - can be removed in production
    return userDataHeader;
  }

  /**
   * Get notifications for the current user
   */
  async getNotifications(
    user: any,
    request: GetNotificationsRequest = {}
  ): Promise<NotificationListResponse> {
    try {
      const headers = this.createUserDataHeader(user);
      
      const requestData = {
        skip: request.skip || 0,
        limit: request.limit || 50,
        unread_only: request.unread_only || false,
        notification_types: request.notification_types || null
      };

      const response = await api.post(
        this.baseUrl,
        requestData,
        { headers }
      );

      return response.data;
    } catch (error) {
      console.error('Error fetching notifications:', error);
      throw error;
    }
  }

  /**
   * Mark specific notifications as read
   */
  async markNotificationsRead(
    user: any,
    notificationIds: number[]
  ): Promise<MarkReadResponse> {
    try {
      const headers = this.createUserDataHeader(user);
      
      const requestData: MarkReadRequest = {
        notification_ids: notificationIds
      };

      const response = await api.post(
        `${this.baseUrl}/mark-read`,
        requestData,
        { headers }
      );

      return response.data;
    } catch (error) {
      console.error('Error marking notifications as read:', error);
      throw error;
    }
  }

  /**
   * Mark all notifications as read
   */
  async markAllNotificationsRead(user: any): Promise<MarkReadResponse> {
    try {
      const headers = this.createUserDataHeader(user);

      const response = await api.post(
        `${this.baseUrl}/mark-all-read`,
        {},
        { headers }
      );

      return response.data;
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      throw error;
    }
  }

  /**
   * Delete specific notifications
   */
  async deleteNotifications(
    user: any,
    notificationIds: number[]
  ): Promise<DeleteNotificationsResponse> {
    try {
      const headers = this.createUserDataHeader(user);
      
      const requestData: DeleteNotificationsRequest = {
        notification_ids: notificationIds
      };

      const response = await api.post(
        `${this.baseUrl}/delete`,
        requestData,
        { headers }
      );

      return response.data;
    } catch (error) {
      console.error('Error deleting notifications:', error);
      throw error;
    }
  }

  /**
   * Get notification statistics
   */
  async getNotificationStats(user: any): Promise<NotificationStats> {
    try {
      const headers = this.createUserDataHeader(user);

      const response = await api.get(
        `${this.baseUrl}/stats`,
        { headers }
      );

      return response.data;
    } catch (error) {
      console.error('Error fetching notification stats:', error);
      throw error;
    }
  }

  /**
   * Get unread notifications count only
   */
  async getUnreadCount(user: any): Promise<number> {
    try {
      const response = await this.getNotifications(user, {
        skip: 0,
        limit: 1,
        unread_only: true
      });
      
      return response.unread_count;
    } catch (error) {
      console.error('Error fetching unread count:', error);
      return 0;
    }
  }
}

// Export singleton instance
export const notificationService = new NotificationService();
