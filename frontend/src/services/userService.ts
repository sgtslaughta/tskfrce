/**
 * User Service
 * 
 * Handles user-related API calls including profile management,
 * user search, and status updates.
 */

import { apiClient } from './apiClient';
import { User } from '../types/user';

export interface UsersResponse {
  users: User[];
  total_count: number;
  has_more: boolean;
}

export interface UserResponse {
  user: User;
  success: boolean;
}

export interface UpdateUserRequest {
  first_name?: string;
  last_name?: string;
  email?: string;
  avatar?: File;
  bio?: string;
  phone?: string;
  timezone?: string;
  language?: string;
  notification_preferences?: {
    email_notifications: boolean;
    push_notifications: boolean;
    desktop_notifications: boolean;
    sound_notifications: boolean;
  };
}

class UserService {
  /**
   * Get all users
   */
  async getUsers(params?: {
    limit?: number;
    offset?: number;
    search?: string;
    role?: string;
    is_active?: boolean;
    sort_by?: string;
    sort_order?: 'asc' | 'desc';
  }): Promise<UsersResponse> {
    const response = await apiClient.get('/users', { params });
    return response.data;
  }

  /**
   * Get user by ID
   */
  async getUser(userId: number): Promise<UserResponse> {
    const response = await apiClient.get(`/users/${userId}`);
    return response.data;
  }

  /**
   * Get current user profile
   */
  async getCurrentUser(): Promise<UserResponse> {
    const response = await apiClient.get('/users/me');
    return response.data;
  }

  /**
   * Update user profile
   */
  async updateUser(userId: number, updates: UpdateUserRequest): Promise<UserResponse> {
    const formData = new FormData();
    
    Object.entries(updates).forEach(([key, value]) => {
      if (value !== undefined) {
        if (key === 'avatar' && value instanceof File) {
          formData.append(key, value);
        } else if (typeof value === 'object') {
          formData.append(key, JSON.stringify(value));
        } else {
          formData.append(key, value.toString());
        }
      }
    });

    const response = await apiClient.put(`/users/${userId}`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  }

  /**
   * Update current user profile
   */
  async updateCurrentUser(updates: UpdateUserRequest): Promise<UserResponse> {
    const formData = new FormData();
    
    Object.entries(updates).forEach(([key, value]) => {
      if (value !== undefined) {
        if (key === 'avatar' && value instanceof File) {
          formData.append(key, value);
        } else if (typeof value === 'object') {
          formData.append(key, JSON.stringify(value));
        } else {
          formData.append(key, value.toString());
        }
      }
    });

    const response = await apiClient.put('/users/me', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  }

  /**
   * Search users
   */
  async searchUsers(query: string, params?: {
    limit?: number;
    exclude_user_ids?: number[];
    role?: string;
    is_active?: boolean;
  }): Promise<UsersResponse> {
    const response = await apiClient.get('/users/search', {
      params: { query, ...params }
    });
    return response.data;
  }

  /**
   * Get user's online status
   */
  async getUserStatus(userId: number): Promise<{
    is_online: boolean;
    last_seen: string;
    status_message?: string;
  }> {
    const response = await apiClient.get(`/users/${userId}/status`);
    return response.data;
  }

  /**
   * Update user's online status
   */
  async updateUserStatus(status: {
    is_online: boolean;
    status_message?: string;
  }): Promise<{ success: boolean }> {
    const response = await apiClient.post('/users/me/status', status);
    return response.data;
  }

  /**
   * Get online users
   */
  async getOnlineUsers(): Promise<{
    online_users: Array<{
      user: User;
      last_seen: string;
      status_message?: string;
    }>;
  }> {
    const response = await apiClient.get('/users/online');
    return response.data;
  }

  /**
   * Change password
   */
  async changePassword(data: {
    current_password: string;
    new_password: string;
    confirm_password: string;
  }): Promise<{ success: boolean; message: string }> {
    const response = await apiClient.post('/users/me/change-password', data);
    return response.data;
  }

  /**
   * Get user preferences
   */
  async getUserPreferences(): Promise<{
    preferences: {
      theme: 'light' | 'dark' | 'auto';
      language: string;
      timezone: string;
      date_format: string;
      time_format: '12h' | '24h';
      notifications: {
        email_notifications: boolean;
        push_notifications: boolean;
        desktop_notifications: boolean;
        sound_notifications: boolean;
        notification_frequency: 'immediate' | 'hourly' | 'daily';
      };
      privacy: {
        show_online_status: boolean;
        show_last_seen: boolean;
        allow_direct_messages: boolean;
      };
    };
  }> {
    const response = await apiClient.get('/users/me/preferences');
    return response.data;
  }

  /**
   * Update user preferences
   */
  async updateUserPreferences(preferences: {
    theme?: 'light' | 'dark' | 'auto';
    language?: string;
    timezone?: string;
    date_format?: string;
    time_format?: '12h' | '24h';
    notifications?: {
      email_notifications?: boolean;
      push_notifications?: boolean;
      desktop_notifications?: boolean;
      sound_notifications?: boolean;
      notification_frequency?: 'immediate' | 'hourly' | 'daily';
    };
    privacy?: {
      show_online_status?: boolean;
      show_last_seen?: boolean;
      allow_direct_messages?: boolean;
    };
  }): Promise<{ success: boolean }> {
    const response = await apiClient.put('/users/me/preferences', preferences);
    return response.data;
  }

  /**
   * Get user activity log
   */
  async getUserActivity(userId?: number, params?: {
    limit?: number;
    offset?: number;
    date_from?: string;
    date_to?: string;
    activity_type?: string;
  }): Promise<{
    activities: Array<{
      id: number;
      activity_type: string;
      description: string;
      metadata?: any;
      ip_address?: string;
      user_agent?: string;
      created_at: string;
    }>;
    total_count: number;
  }> {
    const endpoint = userId ? `/users/${userId}/activity` : '/users/me/activity';
    const response = await apiClient.get(endpoint, { params });
    return response.data;
  }

  /**
   * Get user statistics
   */
  async getUserStats(userId?: number): Promise<{
    stats: {
      tasks_created: number;
      tasks_completed: number;
      comments_made: number;
      messages_sent: number;
      files_uploaded: number;
      login_count: number;
      last_login: string;
      account_created: string;
      total_time_logged: number; // in minutes
    };
  }> {
    const endpoint = userId ? `/users/${userId}/stats` : '/users/me/stats';
    const response = await apiClient.get(endpoint);
    return response.data;
  }

  /**
   * Block/unblock user
   */
  async blockUser(userId: number): Promise<{ success: boolean; message: string }> {
    const response = await apiClient.post(`/users/${userId}/block`);
    return response.data;
  }

  async unblockUser(userId: number): Promise<{ success: boolean; message: string }> {
    const response = await apiClient.delete(`/users/${userId}/block`);
    return response.data;
  }

  /**
   * Get blocked users
   */
  async getBlockedUsers(): Promise<{
    blocked_users: Array<{
      user: User;
      blocked_at: string;
    }>;
  }> {
    const response = await apiClient.get('/users/me/blocked');
    return response.data;
  }

  /**
   * Follow/unfollow user
   */
  async followUser(userId: number): Promise<{ success: boolean; message: string }> {
    const response = await apiClient.post(`/users/${userId}/follow`);
    return response.data;
  }

  async unfollowUser(userId: number): Promise<{ success: boolean; message: string }> {
    const response = await apiClient.delete(`/users/${userId}/follow`);
    return response.data;
  }

  /**
   * Get user's followers/following
   */
  async getUserFollowers(userId: number): Promise<{
    followers: User[];
    total_count: number;
  }> {
    const response = await apiClient.get(`/users/${userId}/followers`);
    return response.data;
  }

  async getUserFollowing(userId: number): Promise<{
    following: User[];
    total_count: number;
  }> {
    const response = await apiClient.get(`/users/${userId}/following`);
    return response.data;
  }

  /**
   * Export user data
   */
  async exportUserData(format: 'json' | 'csv'): Promise<{
    download_url: string;
    expires_at: string;
  }> {
    const response = await apiClient.post('/users/me/export', { format });
    return response.data;
  }

  /**
   * Delete user account
   */
  async deleteAccount(password: string): Promise<{
    success: boolean;
    message: string;
  }> {
    const response = await apiClient.delete('/users/me', {
      data: { password }
    });
    return response.data;
  }

  /**
   * Get user's teams/groups
   */
  async getUserTeams(userId?: number): Promise<{
    teams: Array<{
      id: number;
      name: string;
      description?: string;
      role: string;
      joined_at: string;
    }>;
  }> {
    const endpoint = userId ? `/users/${userId}/teams` : '/users/me/teams';
    const response = await apiClient.get(endpoint);
    return response.data;
  }

  /**
   * Get user's recent activity
   */
  async getRecentActivity(userId?: number, limit: number = 10): Promise<{
    activities: Array<{
      id: number;
      type: 'task_created' | 'task_completed' | 'comment_added' | 'message_sent' | 'file_uploaded';
      description: string;
      entity_type: string;
      entity_id: number;
      created_at: string;
    }>;
  }> {
    const endpoint = userId ? `/users/${userId}/recent-activity` : '/users/me/recent-activity';
    const response = await apiClient.get(endpoint, { params: { limit } });
    return response.data;
  }

  /**
   * Set user avatar
   */
  async setAvatar(avatarFile: File): Promise<{
    avatar_url: string;
    success: boolean;
  }> {
    const formData = new FormData();
    formData.append('avatar', avatarFile);

    const response = await apiClient.post('/users/me/avatar', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  }

  /**
   * Remove user avatar
   */
  async removeAvatar(): Promise<{ success: boolean }> {
    const response = await apiClient.delete('/users/me/avatar');
    return response.data;
  }

  /**
   * Get users available for task assignment
   */
  async getUsersForAssignment(params?: {
    limit?: number;
    search?: string;
    exclude_inactive?: boolean;
  }): Promise<User[]> {
    const response = await apiClient.get('/users/for-assignment', { params });
    return response.data.users || response.data;
  }
}

export const userService = new UserService();