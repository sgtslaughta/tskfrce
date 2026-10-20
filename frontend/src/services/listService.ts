/**
 * @fileoverview Task List Service for TaaskMaaster
 * @description Service for managing task lists and list operations
 * @author TaaskMaaster Team
 * @version 1.0.0
 */

import { api } from './api';

/**
 * @description Task list interface
 */
export interface TaskList {
  id: number;
  name: string;
  description?: string;
  color: string;
  is_public: boolean;
  is_archived: boolean;
  created_by_id: number;
  created_at: string;
  updated_at: string;
  task_count: number;
  completed_task_count: number;
}

/**
 * @description Task list with tasks interface
 */
export interface TaskListWithTasks extends TaskList {
  tasks: any[];
}

/**
 * @description Task list creation interface
 */
export interface TaskListCreate {
  name: string;
  description?: string;
  color?: string;
  is_public?: boolean;
  is_archived?: boolean;
}

/**
 * @description Task list update interface
 */
export interface TaskListUpdate {
  name?: string;
  description?: string;
  color?: string;
  is_public?: boolean;
  is_archived?: boolean;
}

/**
 * @description Task list association interface
 */
export interface TaskListAssociation {
  task_id: number;
  position?: number;
}

/**
 * @description Task list bulk update interface
 */
export interface TaskListBulkUpdate {
  task_positions: Array<{ task_id: number; position: number }>;
}

/**
 * @description Task list statistics interface
 */
export interface TaskListStats {
  total_lists: number;
  total_tasks: number;
  completed_tasks: number;
  completion_rate: number;
  most_active_list?: string;
  recent_activity: any[];
}

/**
 * @description Task list service class
 */
export class ListService {
  /**
   * @description Get all task lists for the current user
   * @param skip - Number of records to skip
   * @param limit - Maximum number of records to return
   * @param includeArchived - Whether to include archived lists
   * @returns Promise with task lists
   */
  static async getTaskLists(
    skip: number = 0,
    limit: number = 100,
    includeArchived: boolean = false
  ): Promise<TaskList[]> {
    const params = new URLSearchParams({
      skip: skip.toString(),
      limit: limit.toString(),
      include_archived: includeArchived.toString(),
    });

    const response = await api.get(`/lists/?${params}`);
    return response.data;
  }

  /**
   * @description Create a new task list
   * @param taskList - Task list data
   * @returns Promise with created task list
   */
  static async createTaskList(taskList: TaskListCreate): Promise<TaskList> {
    const response = await api.post('/lists/', taskList);
    return response.data;
  }

  /**
   * @description Get a specific task list with its tasks
   * @param listId - Task list ID
   * @returns Promise with task list and tasks
   */
  static async getTaskList(listId: number): Promise<TaskListWithTasks> {
    const response = await api.get(`/lists/${listId}`);
    return response.data;
  }

  /**
   * @description Update a task list
   * @param listId - Task list ID
   * @param taskListUpdate - Updated task list data
   * @returns Promise with updated task list
   */
  static async updateTaskList(
    listId: number,
    taskListUpdate: TaskListUpdate
  ): Promise<TaskList> {
    const response = await api.put(`/lists/${listId}`, taskListUpdate);
    return response.data;
  }

  /**
   * @description Delete a task list
   * @param listId - Task list ID
   * @returns Promise
   */
  static async deleteTaskList(listId: number): Promise<void> {
    await api.delete(`/lists/${listId}`);
  }

  /**
   * @description Add a task to a list
   * @param listId - Task list ID
   * @param association - Task association data
   * @returns Promise with created association
   */
  static async addTaskToList(
    listId: number,
    association: TaskListAssociation
  ): Promise<any> {
    const response = await api.post(`/lists/${listId}/tasks`, association);
    return response.data;
  }

  /**
   * @description Remove a task from a list
   * @param listId - Task list ID
   * @param taskId - Task ID
   * @returns Promise
   */
  static async removeTaskFromList(listId: number, taskId: number): Promise<void> {
    await api.delete(`/lists/${listId}/tasks/${taskId}`);
  }

  /**
   * @description Reorder tasks within a list
   * @param listId - Task list ID
   * @param bulkUpdate - New task positions
   * @returns Promise with updated associations
   */
  static async reorderTasksInList(
    listId: number,
    bulkUpdate: TaskListBulkUpdate
  ): Promise<any[]> {
    const response = await api.put(`/lists/${listId}/tasks/reorder`, bulkUpdate);
    return response.data;
  }

  /**
   * @description Get task list statistics
   * @returns Promise with list statistics
   */
  static async getListStats(): Promise<TaskListStats> {
    const response = await api.get('/lists/stats/overview');
    return response.data;
  }

  /**
   * @description Archive a task list
   * @param listId - Task list ID
   * @returns Promise with updated task list
   */
  static async archiveTaskList(listId: number): Promise<TaskList> {
    return this.updateTaskList(listId, { is_archived: true });
  }

  /**
   * @description Unarchive a task list
   * @param listId - Task list ID
   * @returns Promise with updated task list
   */
  static async unarchiveTaskList(listId: number): Promise<TaskList> {
    return this.updateTaskList(listId, { is_archived: false });
  }

  /**
   * @description Toggle public/private status of a list
   * @param listId - Task list ID
   * @param isPublic - Whether list should be public
   * @returns Promise with updated task list
   */
  static async toggleListVisibility(
    listId: number,
    isPublic: boolean
  ): Promise<TaskList> {
    return this.updateTaskList(listId, { is_public: isPublic });
  }

  /**
   * @description Get completion percentage for a list
   * @param taskCount - Total number of tasks
   * @param completedCount - Number of completed tasks
   * @returns Completion percentage
   */
  static getCompletionPercentage(taskCount: number, completedCount: number): number {
    if (taskCount === 0) return 0;
    return Math.round((completedCount / taskCount) * 100);
  }

  /**
   * @description Get color variants for list colors
   * @returns Array of color options
   */
  static getColorVariants(): string[] {
    return [
      '#3B82F6', // Blue
      '#EF4444', // Red
      '#10B981', // Green
      '#F59E0B', // Yellow
      '#8B5CF6', // Purple
      '#F97316', // Orange
      '#06B6D4', // Cyan
      '#EC4899', // Pink
      '#84CC16', // Lime
      '#6B7280', // Gray
    ];
  }
}

export default ListService;
