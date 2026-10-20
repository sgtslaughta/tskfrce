/**
 * @fileoverview Task History Service for TaaskMaaster
 * @description Service for fetching task activity and status change history
 * @author TaaskMaaster Team
 * @version 1.0.0
 */

import { api } from './api';

/**
 * @description Task status history item from backend
 */
export interface TaskStatusHistory {
  id: number;
  task_id: number;
  user_id: number;
  previous_status: string | null;
  new_status: string;
  comment: string | null;
  created_at: string;
  user: {
    id: number;
    username: string;
    email: string;
    first_name: string;
    last_name: string;
  };
}

/**
 * @description Response from task history API
 */
export interface TaskHistoryResponse {
  history: TaskStatusHistory[];
  total: number;
}

/**
 * @description User interface for task history service
 */
export interface TaskHistoryUser {
  id: string;
  username: string;
  email?: string;
  role?: string;
}

/**
 * @description Create user data header for API requests
 */
const createUserDataHeader = (user: TaskHistoryUser) => {
  return {
    'X-User-Data': JSON.stringify({
      user_id: parseInt(user.id),
      username: user.username,
      email: user.email || '',
      role: user.role || 'user'
    })
  };
};

/**
 * @description Task History Service
 */
export class TaskHistoryService {
  /**
   * @description Get task status history
   * @param taskId - Task ID
   * @param user - Current user information
   * @param skip - Number of records to skip for pagination
   * @param limit - Maximum number of records to return
   * @returns Promise with task history data
   */
  async getTaskHistory(taskId: number, user: TaskHistoryUser, skip: number = 0, limit: number = 100): Promise<TaskHistoryResponse> {
    try {
      const headers = createUserDataHeader(user);
      const response = await api.get<TaskHistoryResponse>(
        `/workflow/history/${taskId}?skip=${skip}&limit=${limit}`,
        { headers }
      );
      return response.data;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to fetch task history: ${error.message}`);
      }
      throw new Error('Failed to fetch task history: Unknown error');
    }
  }

  /**
   * @description Format status for display
   * @param status - Status string from backend
   * @returns Formatted status string
   */
  formatStatus(status: string): string {
    return status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }

  /**
   * @description Get status change description
   * @param previousStatus - Previous status (can be null for initial creation)
   * @param newStatus - New status
   * @returns Human-readable description of the change
   */
  getStatusChangeDescription(previousStatus: string | null, newStatus: string): string {
    if (!previousStatus) {
      return `Task created with status "${this.formatStatus(newStatus)}"`;
    }
    
    return `Status changed from "${this.formatStatus(previousStatus)}" to "${this.formatStatus(newStatus)}"`;
  }

  /**
   * @description Get icon for status change
   * @param previousStatus - Previous status
   * @param newStatus - New status
   * @returns Icon name or emoji for the status change
   */
  getStatusChangeIcon(previousStatus: string | null, newStatus: string): string {
    if (!previousStatus) {
      return '🆕'; // New task
    }
    
    switch (newStatus) {
      case 'todo':
        return '📋';
      case 'in_progress':
        return '🔄';
      case 'submitted_for_approval':
        return '📤';
      case 'done':
        return '✅';
      case 'cancelled':
        return '❌';
      default:
        return '🔄';
    }
  }
}

// Export singleton instance
export const taskHistoryService = new TaskHistoryService();
